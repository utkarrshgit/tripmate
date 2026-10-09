from app.agents.base import BaseAgent
from app.agents.state import AgentState


class BudgetAgent(BaseAgent):
    name = "budget"

    async def run(self, state: AgentState) -> AgentState:
        total = (
            state.get("estimated_transport_cost", 0)
            + state.get("estimated_hotel_cost", 0)
            + state.get("estimated_activity_cost", 0)
            + state.get("estimated_food_cost", 0)
        )
        state["total_cost"] = round(total, 2)

        budget = state.get("budget", 0)
        if budget and total > budget:
            state.setdefault("issues", []).append(
                f"The estimate of ₹{total:,.0f} is more than your ₹{budget:,.0f} budget."
            )

        return self.mark_completed(state)
