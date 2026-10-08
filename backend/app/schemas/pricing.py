from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.trip import MAX_TRIP_DAYS


class PriceRequest(BaseModel):
    """Everything a provider needs to quote exact prices for a planned trip."""

    destination: str = Field(min_length=2)
    start_date: date
    end_date: date
    travelers: int = Field(default=1, ge=1, le=20)
    origin: str | None = Field(default=None, description="City the travelers start from; needed for transport")

    @model_validator(mode="after")
    def check_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date.")
        if (self.end_date - self.start_date).days + 1 > MAX_TRIP_DAYS:
            raise ValueError(f"Trips can be at most {MAX_TRIP_DAYS} days long.")
        return self

    @property
    def nights(self) -> int:
        return max((self.end_date - self.start_date).days, 1)

    @property
    def rooms(self) -> int:
        return (self.travelers + 1) // 2


class PriceQuote(BaseModel):
    """One priced option, normalised across providers. `price` is the total for the whole group."""

    kind: Literal["transport", "stay"]
    name: str
    detail: str = ""
    price: float
    currency: str = "INR"


class PriceResponse(BaseModel):
    status: Literal["ok", "unavailable"]
    source: str = Field(description='Provider that produced the quotes, e.g. "sample" or "liteapi"')
    is_sample: bool = Field(default=False, description="True when prices are generated for development, not real fares")
    transport: list[PriceQuote] = []
    stays: list[PriceQuote] = []
    message: str | None = None
    fetched_at: datetime
