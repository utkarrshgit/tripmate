from datetime import date

from pydantic import BaseModel, Field, model_validator

MAX_TRIP_DAYS = 30


class TripRequest(BaseModel):
    query: str = Field(min_length=3, description="Natural-language trip request")
    start_date: date | None = Field(default=None, description="First day of the trip")
    end_date: date | None = Field(default=None, description="Last day of the trip (inclusive)")

    @model_validator(mode="after")
    def check_dates(self):
        if (self.start_date is None) != (self.end_date is None):
            raise ValueError("Provide both start_date and end_date, or neither.")
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValueError("end_date must be on or after start_date.")
            if (self.end_date - self.start_date).days + 1 > MAX_TRIP_DAYS:
                raise ValueError(f"Trips can be at most {MAX_TRIP_DAYS} days long.")
        return self


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

    start_date: date | None = None
    end_date: date | None = None
    # Prices in a plan are always estimates; exact prices come from POST /api/trips/price.
    pricing: str = "estimate"

    interests: list[str] = []
    destination_info: dict = {}
    transport_options: list[dict] = []
    hotel_options: list[dict] = []
    activities: list[dict] = []
    food_options: list[dict] = []
    cost_breakdown: dict[str, float] = {}
