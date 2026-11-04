from app.agents.base import BaseAgent
from app.agents.context import RunContext
from app.agents.state import AgentState
from app.agents.transport_agent import estimate_for


class FoodAgent(BaseAgent):
    """Budgets meals at the destination's typical cost a day, and lists the catalog's places to eat. No model needed."""

    name = "food"

    async def run(self, state: AgentState, ctx: RunContext) -> AgentState:
        days = max(state.get("days", 3), 1)
        travelers = max(state.get("travelers", 1), 1)
        daily_per_person = estimate_for(state, ctx).food_per_person_day
        total = days * travelers * daily_per_person

        state["food_options"] = [
            {
                "category": "local meals",
                "estimated_daily_per_person": daily_per_person,
                "estimated_trip_total": total,
            }
        ]
        state["food_places"] = [
            {"name": p["name"], "place_id": p["id"], "cost_per_person": p["est_cost"], "tags": p["tags"]}
            for p in (ctx.catalog or {}).get("places", [])
            if p["kind"] == "food"
        ]
        state["estimated_food_cost"] = float(total)
        return self.mark_completed(state)
