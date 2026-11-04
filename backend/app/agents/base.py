from abc import ABC, abstractmethod
from typing import Any

from app.agents.context import RunContext
from app.agents.state import AgentState
from app.core.logger import get_logger


class BaseAgent(ABC):
    """Base class shared by all TripMate agents. Each reads the shared state, does its part, and returns it."""

    name = "base_agent"

    def __init__(self):
        self.logger = get_logger(self.name)

    @abstractmethod
    async def run(self, state: AgentState, ctx: RunContext) -> AgentState:
        """Read the shared state, perform work, and return updated state. `ctx.gateway` reaches the models."""
        raise NotImplementedError

    def mark_completed(self, state: AgentState) -> AgentState:
        completed = list(state.get("completed_agents", []))
        if self.name not in completed:
            completed.append(self.name)
        state["completed_agents"] = completed
        return state

    @staticmethod
    def safe_json(text: str, default: Any):
        """Best-effort JSON parsing for LLM output."""
        import json

        try:
            return json.loads(text)
        except (json.JSONDecodeError, TypeError):
            return default
