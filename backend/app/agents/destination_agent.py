import calendar

from app.agents.base import BaseAgent
from app.agents.context import RunContext
from app.agents.state import AgentState


class DestinationAgent(BaseAgent):
    """Looks the place up in TripMate's catalog. Every later agent chooses only from what it finds."""

    name = "destination"

    async def run(self, state: AgentState, ctx: RunContext) -> AgentState:
        destination = state.get("destination") or ""
        interests = state.get("interests", [])
        ctx.catalog = await ctx.load_catalog(destination) if destination else None

        if ctx.catalog:
            d = ctx.catalog["destination"]
            state["destination"] = d["name"]  # the catalog's spelling
            state["destination_info"] = {
                "destination": d["name"],
                "state": d["state"],
                "summary": d["summary"],
                "best_months": [calendar.month_abbr[m] for m in d["best_months"]],
                "best_for": interests or d["interests"],
                "in_catalog": True,
            }
        else:
            state["destination_info"] = {
                "destination": destination,
                "days": state.get("days", 3),
                "interests": interests,
                "summary": f"Trip research prepared for {destination}." if destination else "Trip research prepared.",
                "best_for": interests or ["general sightseeing"],
                "in_catalog": False,
            }
        return self.mark_completed(state)
