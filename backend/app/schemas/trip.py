from pydantic import BaseModel, Field


class TripRequest(BaseModel):
    query: str = Field(min_length=3, description="Natural-language trip request")


class TripResponse(BaseModel):
    destination: str
    days: int
    travelers: int
    budget: float
    total_cost: float
    itinerary: list[dict]
    issues: list[str]
    completed_agents: list[str]
    final_response: str
