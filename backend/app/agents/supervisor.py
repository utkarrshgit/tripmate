from datetime import date

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

    async def run(self, user_query: str, *, start_date: date | None = None, end_date: date | None = None) -> AgentState:
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

        # 1. Understand the request.
        state = await self.planner.run(state)

        # 2. Gather domain-specific information.
        for agent in [
            self.destination,
            self.transport,
            self.hotel,
            self.activity,
            self.food,
        ]:
            state = await agent.run(state)

        # 3. Calculate cost.
        state = await self.budget.run(state)

        # 4. Build itinerary.
        state = await self.itinerary.run(state)

        # 5. Validate the result.
        state = await self.critic.run(state)

        state["final_response"] = self._build_response(state)

        self.logger.info("Trip completed by agents: %s", state["completed_agents"])
        return state

    def _build_response(self, state: AgentState) -> str:
        budget = state.get("budget", 0)
        total = state.get("total_cost", 0)

        lines = [
            f"TripMate plan for {state.get('destination', 'your trip')}",
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
                f"Day {day['day']}: {day['morning']} → "
                f"{day['afternoon']} → {day['evening']}"
            )

        if state.get("issues"):
            lines.append("")
            lines.append("Things to review:")
            lines.extend(f"- {issue}" for issue in state["issues"])

        return "\n".join(lines)
