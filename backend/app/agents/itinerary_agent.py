from app.agents.base import BaseAgent
from app.agents.state import AgentState


class ItineraryAgent(BaseAgent):
    name = "itinerary"

    async def run(self, state: AgentState) -> AgentState:
        days = max(state.get("days", 3), 1)
        destination = state.get("destination", "destination")
        activities = state.get("activities", [])

        itinerary = []
        for day in range(1, days + 1):
            day_activity = activities[(day - 1) % len(activities)] if activities else {
                "name": "Free exploration",
                "estimated_cost": 0,
            }

            itinerary.append({
                "day": day,
                "morning": f"Breakfast and relaxed start in {destination}",
                "afternoon": day_activity["name"],
                "evening": "Local food and free exploration",
            })

        state["itinerary"] = itinerary
        return self.mark_completed(state)
