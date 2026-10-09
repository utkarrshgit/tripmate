from app.agents.base import BaseAgent
from app.agents.state import AgentState


class FoodAgent(BaseAgent):
    name = "food"

    async def run(self, state: AgentState) -> AgentState:
        days = max(state.get("days", 3), 1)
        travelers = max(state.get("travelers", 1), 1)
        daily_per_person = 600
        total = days * travelers * daily_per_person

        state["food_options"] = [
            {
                "category": "local meals",
                "estimated_daily_per_person": daily_per_person,
                "estimated_trip_total": total,
            }
        ]
        state["estimated_food_cost"] = float(total)
        return self.mark_completed(state)
