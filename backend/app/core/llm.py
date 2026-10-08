import httpx

from app.core.config import settings
from app.core.logger import get_logger


class LLMClient:
    """Small Ollama client. Agents can use it without depending on a framework."""

    def __init__(self):
        self.base_url = settings.ollama_base_url.rstrip("/")
        self.model = settings.ollama_model
        self.logger = get_logger("llm")

    async def generate(self, prompt: str, system: str = "") -> str:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system,
            "stream": False,
        }

        try:
            async with httpx.AsyncClient(timeout=90) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                return data.get("response", "")
        except Exception as exc:
            self.logger.warning("Ollama unavailable: %s", exc)
            return ""
