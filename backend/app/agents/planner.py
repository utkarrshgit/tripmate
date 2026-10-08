import re

from app.agents.base import BaseAgent
from app.agents.state import AgentState


class PlannerAgent(BaseAgent):
    name = "planner"

    async def run(self, state: AgentState) -> AgentState:
        query = state.get("user_query", "")

        # Simple deterministic extraction keeps the MVP usable even without an LLM.
        destination = self._extract_destination(query)
        days = self._extract_days(query)
        budget = self._extract_budget(query)
        travelers = self._extract_travelers(query)
        interests = self._extract_interests(query)

        state["destination"] = destination
        state["days"] = days
        state["budget"] = budget
        state["travelers"] = travelers
        state["interests"] = interests

        self.logger.info(
            "Parsed trip: destination=%s days=%s budget=%s travelers=%s",
            destination, days, budget, travelers
        )

        return self.mark_completed(state)

    def _extract_destination(self, query: str) -> str:
        patterns = [
            r"(?:to|visit|for)\s+([A-Za-z][A-Za-z .'-]{2,40}?)(?:\s+for\s+\d+\s*(?:days?|nights?)|\s+under\s+₹?[\d,]+|\s+with\s+₹?[\d,]+|$)",
        ]
        for pattern in patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                return match.group(1).strip(" .,")
        return "Unknown destination"

    def _extract_days(self, query: str) -> int:
        match = re.search(r"(\d+)\s*(?:days?|day)", query, re.IGNORECASE)
        return int(match.group(1)) if match else 3

    def _extract_budget(self, query: str) -> float:
        patterns = [
            r"(?:under|within|budget(?:\s+of)?|₹)\s*₹?\s*([\d,]+)",
            r"₹\s*([\d,]+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                return float(match.group(1).replace(",", ""))
        return 0.0

    def _extract_travelers(self, query: str) -> int:
        match = re.search(r"(\d+)\s*(?:people|persons|travelers|travellers|friends)", query, re.IGNORECASE)
        return int(match.group(1)) if match else 1

    def _extract_interests(self, query: str) -> list[str]:
        keywords = [
            "adventure", "trekking", "nature", "food", "nightlife",
            "culture", "shopping", "beaches", "mountains", "photography",
            "history", "spiritual"
        ]
        lowered = query.lower()
        return [word for word in keywords if word in lowered]
