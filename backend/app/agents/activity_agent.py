from app.agents.base import BaseAgent
from app.agents.state import AgentState


class ActivityAgent(BaseAgent):
    name = "activity"

    async def run(self, state: AgentState) -> AgentState:
        destination = state.get("destination") or ""
        interests = state.get("interests", [])

        defaults = [
            {"name": f"{destination} sightseeing" if destination else "Local sightseeing", "estimated_cost": 500},
            {"name": "Viewpoints and landmarks", "estimated_cost": 300},
            {"name": "Local experiences", "estimated_cost": 700},
        ]

        if "trekking" in interests or "adventure" in interests:
            defaults.append({"name": "Adventure or trek", "estimated_cost": 1200})

        state["activities"] = defaults
        state["estimated_activity_cost"] = float(sum(x["estimated_cost"] for x in defaults))
        return self.mark_completed(state)
