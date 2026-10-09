from app.agents.base import BaseAgent
from app.agents.state import AgentState


class TransportAgent(BaseAgent):
    name = "transport"

    async def run(self, state: AgentState) -> AgentState:
        travelers = state.get("travelers", 1)
        destination = state.get("destination") or ""

        base = 2500
        estimated = base * travelers

        state["transport_options"] = [
            {
                "mode": "Train or bus",
                "description": f"Return trip to {destination} by public transport" if destination else "Return trip by public transport",
                "estimated_cost": estimated,
            },
            {
                "mode": "Flight",
                "description": "Return flight",
                "estimated_cost": estimated * 2.5,
            },
        ]
        state["estimated_transport_cost"] = float(estimated)
        return self.mark_completed(state)
