from app.agents.base import BaseAgent
from app.agents.context import RunContext
from app.agents.state import AgentState
from app.agents.transport_agent import estimate_for


class HotelAgent(BaseAgent):
    """Prices rooms (one per two people) night by night, following the season, festivals and weekends."""

    name = "hotel"

    async def run(self, state: AgentState, ctx: RunContext) -> AgentState:
        stays = estimate_for(state, ctx).stays
        state["hotel_options"] = stays
        state["estimated_hotel_cost"] = float(stays[0]["estimated_total"])  # the budget stay counts
        return self.mark_completed(state)
