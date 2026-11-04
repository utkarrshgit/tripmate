"""
The one place TripMate talks to Ollama. Agents ask it to:

  extract(...)  fill a JSON schema with the general model (gemma4), checked by Pydantic
  decide(...)   answer yes/no or pick a label with the decision model (tev1), with a confidence
  embed(...)    turn text into vectors with the embedding model (qwen3-embedding)

Every method returns None instead of raising when the model is off, slow or wrong, so the
agent falls back to its rules and a plan is never blocked. After one connection failure in
a run, the rest of the run skips the models instead of waiting on each one. Every call is
recorded (model, tokens, time, ok) for the model activity page.
"""

import asyncio
import json
import time
from dataclasses import dataclass, field

import hashlib

import httpx
from pydantic import BaseModel, ValidationError

from app.core.cache import MISS, TTLCache
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("llm")

# Ollama runs one model at a time well on a laptop; queue calls instead of piling them on.
_slots = asyncio.Semaphore(2)

# Repeated questions get the same answer from memory: replies are deterministic (temperature 0).
answers = TTLCache(size=512, ttl=30 * 60)
vectors = TTLCache(size=4096, ttl=6 * 60 * 60)


def _key(*parts) -> str:
    return hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()


@dataclass
class Call:
    agent: str
    model: str
    purpose: str
    ok: bool
    latency_ms: int
    prompt_tokens: int = 0
    output_tokens: int = 0
    error: str | None = None


@dataclass
class Gateway:
    """One per planning run: holds that run's calls and whether Ollama answered."""

    enabled: bool = field(default_factory=lambda: settings.ai_enabled)
    calls: list[Call] = field(default_factory=list)
    reachable: bool = True
    cached: int = 0  # answers this run took from the cache instead of the model

    @property
    def base(self) -> str:
        return settings.ollama_base_url.rstrip("/")

    def _record(self, call: Call) -> None:
        self.calls.append(call)
        level = logger.info if call.ok else logger.warning
        level("%s · %s · %s · %d ms%s", call.agent, call.model, "ok" if call.ok else "fallback", call.latency_ms, f" · {call.error}" if call.error else "")

    async def _post(self, path: str, body: dict, timeout: float) -> tuple[dict | None, str | None]:
        if not (self.enabled and self.reachable):
            return None, "skipped"
        try:
            async with _slots, httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(f"{self.base}{path}", json=body)
            if res.status_code != 200:
                return None, f"HTTP {res.status_code}"
            return res.json(), None
        except httpx.ConnectError:
            self.reachable = False  # Ollama isn't running: don't wait on it again this run
            return None, "Ollama isn't running"
        except httpx.TimeoutException:
            return None, "timed out"
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            return None, type(exc).__name__

    async def extract[T: BaseModel](self, agent: str, schema: type[T], system: str, prompt: str, *, timeout: float = 45) -> T | None:
        """Asks the general model for JSON matching `schema`. One retry, then None."""
        model = settings.ollama_llm_model
        key = _key("extract", model, schema.__name__, system, prompt)
        if self.enabled and (hit := answers.get(key)) is not MISS:
            self.cached += 1
            self.calls.append(Call(agent, model, "cache", True, 0))
            return schema.model_validate(hit)
        body = {
            "model": model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            "format": schema.model_json_schema(),
            "stream": False,
            "think": False,
            "keep_alive": "30m",
            "options": {"temperature": 0},
        }
        error = None
        for _attempt in range(2):
            started = time.perf_counter()
            data, error = await self._post("/api/chat", body, timeout)
            ms = int((time.perf_counter() - started) * 1000)
            if data is None:
                if error == "skipped":
                    return None
                self._record(Call(agent, model, "extract", False, ms, error=error))
                if not self.reachable:
                    return None
                continue
            try:
                result = schema.model_validate_json(data.get("message", {}).get("content", ""))
            except ValidationError as exc:
                error = f"reply didn't match the schema ({exc.error_count()} errors)"
                self._record(Call(agent, model, "extract", False, ms, data.get("prompt_eval_count", 0), data.get("eval_count", 0), error))
                continue
            self._record(Call(agent, model, "extract", True, ms, data.get("prompt_eval_count", 0), data.get("eval_count", 0)))
            answers.set(key, result.model_dump())
            return result
        return None

    async def decide(self, agent: str, state: str, questions: dict, *, timeout: float = 20) -> dict | None:
        """Asks the decision model about `state`. `questions` uses Ollama's /v1/systemone shape:
        {"q1": {"type": "noul", "instructions": "..."}} (yes/no, answered as the probability of yes)
        or {"type": "choice", "instructions": "...", "criteria": {"label": "description"}}."""
        model = settings.ollama_decision_model
        key = _key("decide", model, state[:6000], questions)
        if self.enabled and (hit := answers.get(key)) is not MISS:
            self.cached += 1
            self.calls.append(Call(agent, model, "cache", True, 0))
            return hit
        started = time.perf_counter()
        data, error = await self._post("/v1/systemone", {"model": model, "state": state[:6000], "questions": questions}, timeout)
        ms = int((time.perf_counter() - started) * 1000)
        if data is None:
            if error != "skipped":
                self._record(Call(agent, model, "decide", False, ms, error=error))
            return None
        usage = data.get("usage", {})
        self._record(Call(agent, model, "decide", True, ms, usage.get("input_tokens", 0), usage.get("output_tokens", 0)))
        answers.set(key, data.get("answers"))
        return data.get("answers")

    async def embed(self, agent: str, texts: list[str], *, timeout: float = 30) -> list[list[float]] | None:
        """Vectors for `texts`. Each text's vector is cached, so only new texts reach the model."""
        model = settings.ollama_embed_model
        found = {t: v for t in texts if self.enabled and (v := vectors.get((model, t))) is not MISS}
        missing = list(dict.fromkeys(t for t in texts if t not in found))
        if not missing:
            self.cached += 1
            self.calls.append(Call(agent, model, "cache", True, 0))
            return [found[t] for t in texts]
        started = time.perf_counter()
        data, error = await self._post("/api/embed", {"model": model, "input": missing, "keep_alive": "30m"}, timeout)
        ms = int((time.perf_counter() - started) * 1000)
        if data is None:
            if error != "skipped":
                self._record(Call(agent, model, "embed", False, ms, error=error))
            return None
        self._record(Call(agent, model, "embed", True, ms, data.get("prompt_eval_count", 0), 0))
        for text, vector in zip(missing, data.get("embeddings", [])):
            vectors.set((model, text), vector)
            found[text] = vector
        return [found[t] for t in texts] if all(t in found for t in texts) else None

    def summary(self) -> dict:
        """What the website shows: which model helped, and which agents fell back to rules."""
        used = [c for c in self.calls if c.ok]
        fell_back = sorted({c.agent for c in self.calls if not c.ok} - {c.agent for c in used})
        return {
            "enabled": self.enabled,
            "used": bool(used),
            "models": sorted({c.model for c in used}),
            "agents": sorted({c.agent for c in used}),
            "fell_back": fell_back,
            "calls": len([c for c in self.calls if c.purpose != "cache"]),
            "cached": self.cached,
            "ms": sum(c.latency_ms for c in self.calls),
        }


async def warm_up() -> None:
    """Loads the general and decision models at startup, so the first plan isn't slow. Best effort."""
    if not settings.ai_enabled:
        return
    base = settings.ollama_base_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            await client.post(f"{base}/api/generate", json={"model": settings.ollama_llm_model, "keep_alive": "30m"})
        logger.info("Loaded %s", settings.ollama_llm_model)
    except httpx.HTTPError as exc:
        logger.warning("Couldn't load %s (%s); plans will use rules until Ollama is running", settings.ollama_llm_model, type(exc).__name__)
