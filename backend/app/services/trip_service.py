from datetime import date

from app.agents.supervisor import SupervisorAgent


class TripService:
    def __init__(self):
        self.supervisor = SupervisorAgent()

    async def plan_trip(self, query: str, *, start_date: date | None = None, end_date: date | None = None) -> dict:
        return await self.supervisor.run(query, start_date=start_date, end_date=end_date)
