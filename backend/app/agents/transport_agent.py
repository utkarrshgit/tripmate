from datetime import date

from app.agents.base import BaseAgent
from app.agents.context import RunContext
from app.agents.state import AgentState
from app.pricing.heuristics import estimate


def estimate_for(state: AgentState, ctx: RunContext):
    """The run's price estimate, made once from the destination, dates and group."""
    if ctx.estimate is None:
        start = date.fromisoformat(state["start_date"]) if state.get("start_date") else None
        end = date.fromisoformat(state["end_date"]) if state.get("end_date") else None
        ctx.estimate = estimate(state.get("destination") or "", state.get("days", 3), state.get("travelers", 1), start, end)
    return ctx.estimate


class TransportAgent(BaseAgent):
    """Prices getting there and back (the cheapest option counts) and getting around each day."""

    name = "transport"

    async def run(self, state: AgentState, ctx: RunContext) -> AgentState:
        est = estimate_for(state, ctx)
        options = list(est.getting_there)
        options.append({"mode": "Getting around", "description": "Local cabs, autos and ferries for the trip", "estimated_cost": est.local_travel})
        state["transport_options"] = options
        cheapest = min(o["estimated_cost"] for o in est.getting_there)
        state["estimated_transport_cost"] = float(cheapest + est.local_travel)
        state["estimate_notes"] = est.notes
        return self.mark_completed(state)
