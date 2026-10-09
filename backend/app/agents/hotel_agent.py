from app.agents.base import BaseAgent
from app.agents.state import AgentState


class HotelAgent(BaseAgent):
    name = "hotel"

    async def run(self, state: AgentState) -> AgentState:
        days = max(state.get("days", 3), 1)
        travelers = max(state.get("travelers", 1), 1)

        # MVP estimate: one room per two travelers.
        rooms = (travelers + 1) // 2
        nightly = 1800
        total = rooms * nightly * max(days - 1, 1)

        state["hotel_options"] = [
            {
                "name": "Budget stay",
                "category": "budget",
                "nightly_rate": nightly,
                "rooms": rooms,
                "estimated_total": total,
            },
            {
                "name": "Comfort stay",
                "category": "mid-range",
                "nightly_rate": 3000,
                "rooms": rooms,
                "estimated_total": 3000 * rooms * max(days - 1, 1),
            },
        ]
        state["estimated_hotel_cost"] = float(total)
        return self.mark_completed(state)
