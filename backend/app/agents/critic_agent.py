from app.agents.base import BaseAgent
from app.agents.context import RunContext
from app.agents.state import AgentState

LONG_DAY_HOURS = 10


class CriticAgent(BaseAgent):
    """Final review: things the traveller should know before relying on the plan."""

    name = "critic"

    async def run(self, state: AgentState, ctx: RunContext) -> AgentState:
        issues = list(state.get("issues", []))
        days = state.get("days", 0)

        if days <= 0:
            issues.append("Add how many days you're traveling, like “4 days”.")

        if not state.get("destination"):
            issues.append("We couldn't tell where you're going. Add a place, like “in Goa”.")
        elif not state.get("destination_info", {}).get("in_catalog", True):
            issues.append(f"{state['destination']} isn't in TripMate's guide yet, so the days are general suggestions.")

        if not state.get("itinerary"):
            issues.append("We couldn't build a day-by-day plan. Try again.")

        hours = {a["name"]: a.get("duration_hours", 0) for a in state.get("activities", [])}
        for day in state.get("itinerary", []):
            total = sum(hours.get(day.get(slot), 0) for slot in ("morning", "afternoon", "evening"))
            if total > LONG_DAY_HOURS:
                issues.append(f"Day {day['day']} has about {total:g} hours of activities. Consider moving one to another day.")

        state["issues"] = list(dict.fromkeys(issues))
        return self.mark_completed(state)
