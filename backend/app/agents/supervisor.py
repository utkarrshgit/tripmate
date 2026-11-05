from datetime import date

from app.agents.context import RunContext
from app.agents.state import AgentState
from app.agents.planner import PlannerAgent
from app.agents.destination_agent import DestinationAgent
from app.agents.transport_agent import TransportAgent
from app.agents.hotel_agent import HotelAgent
from app.agents.activity_agent import ActivityAgent
from app.agents.food_agent import FoodAgent
from app.agents.budget_agent import BudgetAgent
from app.agents.itinerary_agent import ItineraryAgent
from app.agents.critic_agent import CriticAgent
from app.core.logger import get_logger


class SupervisorAgent:
    """
    Coordinates all TripMate agents through one shared AgentState.

    Later this can be replaced by a LangGraph supervisor without changing
    the individual agent contracts.
    """

    def __init__(self):
        self.logger = get_logger("supervisor")

        self.planner = PlannerAgent()
        self.destination = DestinationAgent()
        self.transport = TransportAgent()
        self.hotel = HotelAgent()
        self.activity = ActivityAgent()
        self.food = FoodAgent()
        self.budget = BudgetAgent()
        self.itinerary = ItineraryAgent()
        self.critic = CriticAgent()

    @property
    def pipeline(self):
        """Every agent, in the order it runs."""
        return [
            self.planner,  # 1. understand the request
            self.destination,  # 2. gather what each part needs
            self.transport,
            self.hotel,
            self.activity,
            self.food,
            self.budget,  # 3. add up the cost
            self.itinerary,  # 4. lay out the days
            self.critic,  # 5. check the result
        ]

    async def run(
        self,
        user_query: str,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
        ctx: RunContext | None = None,
    ) -> AgentState:
        ctx = ctx or RunContext()
        state: AgentState = {
            "user_query": user_query,
            "destination": "",
            "days": 0,
            "budget": 0,
            "interests": [],
            "travelers": 1,
            "completed_agents": [],
            "issues": [],
            "final_response": "",
        }
        if start_date and end_date:
            state["start_date"] = start_date.isoformat()
            state["end_date"] = end_date.isoformat()

        for agent in self.pipeline:
            await self._safe_progress(ctx, agent.name, "start", {})
            calls_before = len(ctx.gateway.calls)
            state = await self._run_safely(agent, state, ctx)
            calls = ctx.gateway.calls[calls_before:]
            await self._safe_progress(
                ctx,
                agent.name,
                "done",
                {
                    "ai": any(c.ok for c in calls),
                    "fell_back": bool(calls) and not any(c.ok for c in calls),
                    "models": sorted({c.model for c in calls if c.ok}),
                    "summary": self._safe_summary(agent.name, state),
                },
            )

        try:
            state["final_response"] = self._build_response(state)
        except Exception:  # noqa: BLE001
            self.logger.exception("Couldn't write the text summary")
            state["final_response"] = ""
        state["ai"] = ctx.gateway.summary()
        self.logger.info("Trip completed by agents: %s (AI: %s)", state["completed_agents"], state["ai"])
        return state

    # What a step leaves behind when it can't run at all, so later steps and the website still work.
    _DEFAULTS = {
        "destination": {"destination_info": {}},
        "transport": {"transport_options": [], "estimated_transport_cost": 0.0},
        "hotel": {"hotel_options": [], "estimated_hotel_cost": 0.0},
        "activity": {"activities": [], "estimated_activity_cost": 0.0},
        "food": {"food_options": [], "food_places": [], "estimated_food_cost": 0.0},
        "budget": {"total_cost": 0.0},
        "itinerary": {"itinerary": []},
    }
    _LABELS = {
        "planner": "reading your request",
        "destination": "the destination details",
        "transport": "getting there",
        "hotel": "stays",
        "activity": "things to do",
        "food": "food",
        "budget": "the total",
        "itinerary": "the day-by-day plan",
        "critic": "the final check",
    }

    async def _run_safely(self, agent, state: AgentState, ctx: RunContext) -> AgentState:
        """Runs one agent. If it fails, tries once more with rules only; if that fails too, keeps
        going with safe defaults and says so in the plan. One part never stops the whole plan."""
        snapshot = dict(state)
        try:
            return await agent.run(state, ctx)
        except Exception:  # noqa: BLE001
            self.logger.exception("%s failed; trying again with rules only", agent.name)
        gateway_on = ctx.gateway.enabled
        try:
            ctx.gateway.enabled = False
            return await agent.run(dict(snapshot), ctx)
        except Exception:  # noqa: BLE001
            self.logger.exception("%s failed again; using defaults", agent.name)
        finally:
            ctx.gateway.enabled = gateway_on
        state = {**snapshot, **self._DEFAULTS.get(agent.name, {})}
        state.setdefault("issues", []).append(f"We couldn't work out {self._LABELS.get(agent.name, agent.name)} this time, so that part is left simple. Try planning again.")
        return state

    @staticmethod
    async def _safe_progress(ctx: RunContext, agent: str, phase: str, details: dict) -> None:
        try:
            await ctx.progress(agent, phase, details)
        except Exception:  # noqa: BLE001 - a lost progress message mustn't stop the plan
            pass

    @classmethod
    def _safe_summary(cls, agent: str, state: AgentState) -> str:
        try:
            return cls._step_summary(agent, state)
        except Exception:  # noqa: BLE001
            return ""

    @staticmethod
    def _step_summary(agent: str, state: AgentState) -> str:
        """One plain line per agent for the live progress, like "Goa · 4 days · 2 people"."""
        if agent == "planner":
            parts = [state.get("destination") or "Somewhere", f"{state.get('days', 0)} days", f"{state.get('travelers', 1)} people"]
            return " · ".join(parts)
        if agent == "destination":
            return "Found in TripMate's guide" if state.get("destination_info", {}).get("in_catalog") else "Not in the guide yet"
        if agent == "activity":
            return f"Chose {len(state.get('activities', []))} things to do"
        if agent == "budget":
            return f"About ₹{state.get('total_cost', 0):,.0f} in total"
        if agent == "itinerary":
            return f"Laid out {len(state.get('itinerary', []))} days"
        if agent == "critic":
            n = len(state.get("issues", []))
            return "No problems found" if n == 0 else f"{n} thing{'s' if n > 1 else ''} to check"
        return ""

    def _build_response(self, state: AgentState) -> str:
        budget = state.get("budget", 0)
        total = state.get("total_cost", 0)

        lines = [
            f"TripMate plan for {state.get('destination') or 'your trip'}",
            f"Duration: {state.get('days', 0)} days",
            f"Travelers: {state.get('travelers', 1)}",
            f"Estimated total: ₹{total:,.0f}",
        ]

        if budget:
            lines.append(f"Budget: ₹{budget:,.0f}")

        lines.append("")
        lines.append("Itinerary:")

        for day in state.get("itinerary", []):
            lines.append(
                f"Day {day['day']}: {day['morning']} · "
                f"{day['afternoon']} · {day['evening']}"
            )

        if state.get("issues"):
            lines.append("")
            lines.append("Things to review:")
            lines.extend(f"- {issue}" for issue in state["issues"])

        return "\n".join(lines)
