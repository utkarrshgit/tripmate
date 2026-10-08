from app.agents.base import BaseAgent
from app.agents.state import AgentState


class TransportAgent(BaseAgent):
    name = "transport"

    async def run(self, state: AgentState) -> AgentState:
        travelers = state.get("travelers", 1)
        destination = state.get("destination", "Unknown")

        base = 2500
        estimated = base * travelers

        state["transport_options"] = [
            {
                "mode": "Train/Bus",
                "description": f"Estimated round-trip public transport to {destination}",
                "estimated_cost": estimated,
            },
            {
                "mode": "Flight",
                "description": "Use live flight API in production",
                "estimated_cost": estimated * 2.5,
            },
        ]
        state["estimated_transport_cost"] = float(estimated)
        return self.mark_completed(state)
