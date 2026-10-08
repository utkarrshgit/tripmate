from app.agents.base import BaseAgent
from app.agents.state import AgentState


class ActivityAgent(BaseAgent):
    name = "activity"

    async def run(self, state: AgentState) -> AgentState:
        destination = state.get("destination", "the destination")
        interests = state.get("interests", [])

        defaults = [
            {"name": f"{destination} city/local sightseeing", "estimated_cost": 500},
            {"name": "Local viewpoint / landmark", "estimated_cost": 300},
            {"name": "Local experience", "estimated_cost": 700},
        ]

        if "trekking" in interests or "adventure" in interests:
            defaults.append({"name": "Adventure / trekking activity", "estimated_cost": 1200})

        state["activities"] = defaults
        state["estimated_activity_cost"] = float(sum(x["estimated_cost"] for x in defaults))
        return self.mark_completed(state)
