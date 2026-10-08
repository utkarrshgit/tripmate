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

    interests: list[str] = []
    destination_info: dict = {}
    transport_options: list[dict] = []
    hotel_options: list[dict] = []
    activities: list[dict] = []
    food_options: list[dict] = []
    cost_breakdown: dict[str, float] = {}
