from app.agents.base import BaseAgent
from app.agents.state import AgentState


class DestinationAgent(BaseAgent):
    name = "destination"

    async def run(self, state: AgentState) -> AgentState:
        destination = state.get("destination") or ""
        days = state.get("days", 3)
        interests = state.get("interests", [])

        state["destination_info"] = {
            "destination": destination,
            "days": days,
            "interests": interests,
            "summary": f"Trip research prepared for {destination}." if destination else "Trip research prepared.",
            "best_for": interests or ["general sightseeing"],
        }
        return self.mark_completed(state)
