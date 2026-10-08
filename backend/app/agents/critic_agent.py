from app.agents.base import BaseAgent
from app.agents.state import AgentState


class CriticAgent(BaseAgent):
    name = "critic"

    async def run(self, state: AgentState) -> AgentState:
        issues = list(state.get("issues", []))
        days = state.get("days", 0)

        if days <= 0:
            issues.append("Trip duration must be greater than zero.")

        if not state.get("destination") or state["destination"] == "Unknown destination":
            issues.append("Destination could not be confidently extracted.")

        if not state.get("itinerary"):
            issues.append("Itinerary was not generated.")

        state["issues"] = list(dict.fromkeys(issues))
        return self.mark_completed(state)
