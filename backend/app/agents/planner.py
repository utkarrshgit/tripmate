import re
from datetime import date

from app.agents.base import BaseAgent
from app.agents.state import AgentState


class PlannerAgent(BaseAgent):
    name = "planner"

    async def run(self, state: AgentState) -> AgentState:
        query = state.get("user_query", "")

        # Simple deterministic extraction keeps the MVP usable even without an LLM.
        destination = self._extract_destination(query)
        # Explicit travel dates win over a day count in the text.
        days = self._days_from_dates(state) or self._extract_days(query)
        budget = self._extract_budget(query)
        travelers = self._extract_travelers(query)
        interests = self._extract_interests(query)

        # "Unknown destination" is an internal marker; people see wording that works without a place.
        state["destination"] = "" if destination == "Unknown destination" else destination
        state["days"] = days
        state["budget"] = budget
        state["travelers"] = travelers
        state["interests"] = interests

        self.logger.info(
            "Parsed trip: destination=%s days=%s budget=%s travelers=%s",
            destination, days, budget, travelers
        )

        return self.mark_completed(state)

    @staticmethod
    def _days_from_dates(state: AgentState) -> int | None:
        start, end = state.get("start_date"), state.get("end_date")
        if not (start and end):
            return None
        return (date.fromisoformat(end) - date.fromisoformat(start)).days + 1

    # Words that end a place name: connectors, month names, and time words.
    _STOP_WORDS = (
        "for|under|within|with|from|on|in|at|during|between|by|and|next|this|budget|starting|till|until|to|"
        "jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|"
        "sep|sept|september|oct|october|nov|november|dec|december|weekend|week|month"
    )

    def _extract_destination(self, query: str) -> str:
        """
        The place after "to"/"visit" (or "in" as a fallback), read word by word
        until a number, punctuation, ₹ or a stop word — so dates, budgets and
        group sizes after the name don't break it.
        """
        stop = rf"(?=\s+(?:{self._STOP_WORDS})\b|\s*[\d₹,.;:!?()]|\s*$)"
        for lead in (r"to|visit|visiting|explore", r"in"):
            pattern = rf"\b(?:{lead})\s+([A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*){{0,3}}?){stop}"
            for match in re.finditer(pattern, query, re.IGNORECASE):
                name = match.group(1).strip(" .,'-")
                if name and not re.fullmatch(rf"(?:{self._STOP_WORDS})", name, re.IGNORECASE):
                    return name.title() if name.islower() else name
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
