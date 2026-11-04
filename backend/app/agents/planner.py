import re
from datetime import date

from app.agents.base import BaseAgent
from app.agents.context import RunContext
from app.agents.state import AgentState
from app.llm import prompts

# Below this probability of "yes, this is a trip request", the plan says so.
NOT_A_TRIP = 0.2


class PlannerAgent(BaseAgent):
    """Reads the request. The general model fills in the details; the rules below check them and fill any gaps."""

    name = "planner"

    async def run(self, state: AgentState, ctx: RunContext) -> AgentState:
        query = state.get("user_query", "")
        rules = {
            "destination": self._extract_destination(query),
            "days": self._extract_days(query),
            "budget": self._extract_budget(query),
            "travelers": self._extract_travelers(query),
            "interests": self._extract_interests(query),
        }
        if rules["destination"] == "Unknown destination":  # an internal marker; people see wording without a place
            rules["destination"] = ""

        ai = await ctx.gateway.extract(self.name, prompts.TripRequest, prompts.READ_REQUEST, f"Today is {date.today().isoformat()}.\nRequest: {query}")
        parsed = self._merge(query, rules, ai)
        # Explicit travel dates win over a day count in the text.
        parsed["days"] = self._days_from_dates(state) or parsed["days"]
        state.update(parsed)

        answers = await ctx.gateway.decide(self.name, query, prompts.IS_TRIP_REQUEST)
        if answers and answers.get("q1", {}).get("noul", 1) < NOT_A_TRIP:
            state.setdefault("issues", []).append("This doesn't look like a trip request. Say where you'd like to go, like “4 days in Goa”.")

        self.logger.info(
            "Parsed trip (%s): destination=%s days=%s budget=%s travelers=%s",
            "model" if ai else "rules", parsed["destination"], parsed["days"], parsed["budget"], parsed["travelers"],
        )
        return self.mark_completed(state)

    @staticmethod
    def _merge(query: str, rules: dict, ai: prompts.TripRequest | None) -> dict:
        """Takes the model's answer where it holds up, and the rules' answer everywhere else."""
        if ai is None:
            return rules
        lowered = query.lower()
        # A destination only counts if it's actually in the request: the model mustn't invent one.
        dest = ai.destination.strip()
        destination = dest if dest and dest.lower() in lowered else rules["destination"]
        if destination.islower():
            destination = destination.title()  # "hampi" → "Hampi"
        # A number only counts if the request mentions numbers at all; "3 days" by default stays the rules' call.
        days = ai.days if ai.days and re.search(r"\d|week|weekend|fortnight", lowered) else rules["days"]
        # Clear wording ("with my wife", "me and my 2 friends", "solo") is more reliable than a small model.
        travelers = PlannerAgent._travelers_from_words(query) or ai.travelers or rules["travelers"]
        budget = float(ai.budget_inr) if ai.budget_inr and re.search(r"\d", lowered) else rules["budget"]
        interests = list(dict.fromkeys([*ai.interests, *rules["interests"]]))
        return {"destination": destination, "days": days, "travelers": travelers, "budget": budget, "interests": interests}

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
        words = self._travelers_from_words(query)
        if words:
            return words
        match = re.search(r"(\d+)\s*(?:people|persons|travelers|travellers|adults)", query, re.IGNORECASE)
        return int(match.group(1)) if match else 1

    _NUMBERS = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
    _PARTNER = r"(?:wife|husband|partner|girlfriend|boyfriend|fianc[ée]e?|spouse|mom|mum|mother|dad|father|sister|brother|friend|son|daughter)"

    @classmethod
    def _travelers_from_words(cls, query: str) -> int | None:
        """Group sizes said in words: None when the request doesn't say."""
        q = query.lower()
        num = r"(\d+|" + "|".join(cls._NUMBERS) + r")"
        value = lambda text: int(text) if text.isdigit() else cls._NUMBERS[text]  # noqa: E731
        if m := re.search(rf"\b(?:me|i)\s+(?:and|&|\+)\s+(?:my\s+)?{num}\s+(?:friends|colleagues|kids|children|cousins|others)", q):
            return value(m.group(1)) + 1  # "me and my 2 friends" is 3
        if m := re.search(rf"\bwith\s+(?:my\s+)?{num}\s+(?:friends|colleagues|kids|children|cousins|others)\b", q):
            return value(m.group(1)) + 1  # "with 6 friends" is 7
        if m := re.search(rf"\bfamily\s+of\s+{num}\b", q):
            return value(m.group(1))
        if m := re.search(rf"\b{num}\s+(?:people|persons|travell?ers|adults|of\s+us)\b", q):
            return value(m.group(1))
        if re.search(rf"\b(?:with|and)\s+my\s+{cls._PARTNER}\b|\bmy\s+{cls._PARTNER}\s+and\s+(?:i|me)\b|\bcouple\b|\bhoneymoon\b", q):
            return 2
        if re.search(r"\b(?:solo|alone|by myself|just me)\b", q):
            return 1
        return None

    def _extract_interests(self, query: str) -> list[str]:
        keywords = [
            "adventure", "trekking", "nature", "food", "nightlife",
            "culture", "shopping", "beaches", "mountains", "photography",
            "history", "spiritual"
        ]
        lowered = query.lower()
        return [word for word in keywords if word in lowered]
