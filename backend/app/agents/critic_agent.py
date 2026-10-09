from app.agents.base import BaseAgent
from app.agents.state import AgentState


class CriticAgent(BaseAgent):
    name = "critic"

    async def run(self, state: AgentState) -> AgentState:
        issues = list(state.get("issues", []))
        days = state.get("days", 0)

        if days <= 0:
            issues.append("Add how many days you're traveling, like “4 days”.")

        if not state.get("destination"):
            issues.append("We couldn't tell where you're going. Add a place, like “in Goa”.")

        if not state.get("itinerary"):
            issues.append("We couldn't build a day-by-day plan. Try again.")

        state["issues"] = list(dict.fromkeys(issues))
        return self.mark_completed(state)
