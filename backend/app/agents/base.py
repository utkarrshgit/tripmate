from abc import ABC, abstractmethod
from typing import Any

from app.core.logger import get_logger
from app.core.llm import LLMClient
from app.agents.state import AgentState


class BaseAgent(ABC):
    """Base class shared by all TripMate agents."""

    name = "base_agent"

    def __init__(self, llm: LLMClient | None = None):
        self.llm = llm or LLMClient()
        self.logger = get_logger(self.name)

    @abstractmethod
    async def run(self, state: AgentState) -> AgentState:
        """Read the shared state, perform work, and return updated state."""
        raise NotImplementedError

    def mark_completed(self, state: AgentState) -> AgentState:
        completed = list(state.get("completed_agents", []))
        if self.name not in completed:
            completed.append(self.name)
        state["completed_agents"] = completed
        return state

    async def ask_llm(self, prompt: str, *, system: str = "") -> str:
        return await self.llm.generate(prompt, system=system)

    @staticmethod
    def safe_json(text: str, default: Any):
        """Best-effort JSON parsing for LLM output."""
        import json

        try:
            return json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return default
