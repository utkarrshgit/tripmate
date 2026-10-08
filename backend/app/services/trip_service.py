from app.agents.supervisor import SupervisorAgent


class TripService:
    def __init__(self):
        self.supervisor = SupervisorAgent()

    async def plan_trip(self, query: str) -> dict:
        return await self.supervisor.run(query)
