"""Request and response shapes for saved trips (/api/v1/trips) and share links (/api/v1/shared)."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Slot = Literal["morning", "afternoon", "evening"]


class PlanIn(BaseModel):
    """A planner response (POST /api/trips/plan), as the website received it. Extra fields are kept."""

    model_config = ConfigDict(extra="allow")

    destination: str = ""
    days: int = Field(ge=1, le=60)
    travelers: int = Field(1, ge=1, le=50)
    budget: float = Field(0, ge=0)
    total_cost: float = Field(0, ge=0)
    itinerary: list[dict] = []
    start_date: date | None = None
    end_date: date | None = None
    cost_breakdown: dict[str, float] = {}
    issues: list[str] = []


class PricingIn(BaseModel):
    """An exact-price check from the website: { origin, response, selection, total, checkedAt }."""

    model_config = ConfigDict(extra="allow")

    total: float = Field(ge=0)


class TripIn(BaseModel):
    query: str = Field(max_length=2000)
    plan: PlanIn
    pricing: PricingIn | None = None
    title: str | None = Field(None, max_length=150)


class ImportIn(BaseModel):
    trips: list[TripIn] = Field(max_length=200)


class TripPatch(BaseModel):
    title: str | None = Field(None, max_length=150)
    status: Literal["saved", "archived"] | None = None


class VersionIn(BaseModel):
    query: str = Field(max_length=2000)
    plan: PlanIn


class ItemIn(BaseModel):
    day_no: int = Field(ge=1, le=60)
    slot: Slot
    title: str = Field(min_length=1, max_length=150)
    note: str | None = Field(None, max_length=2000)
    est_cost: float = Field(0, ge=0)


class ItemPatch(BaseModel):
    day_no: int | None = Field(None, ge=1, le=60)
    slot: Slot | None = None
    title: str | None = Field(None, min_length=1, max_length=150)
    note: str | None = Field(None, max_length=2000)
    est_cost: float | None = Field(None, ge=0)


class ItemOut(BaseModel):
    id: uuid.UUID
    day_no: int
    slot: str
    position: int
    title: str
    note: str | None
    est_cost: float


class VersionSummary(BaseModel):
    no: int
    source: str
    query: str
    total_cost: float
    created_at: datetime
    current: bool


class TripSummary(BaseModel):
    """A trip in a list: enough for a card. `plan` holds only the fields a card shows."""

    id: uuid.UUID
    title: str
    status: str
    query: str
    plan: dict
    has_pricing: bool
    saved_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class TripPage(BaseModel):
    trips: list[TripSummary]
    page: int
    per_page: int
    total: int


class TripOut(TripSummary):
    """A whole trip: the current version's plan (itinerary rebuilt from items), items, pricing and versions."""

    version: VersionSummary
    items: list[ItemOut]
    pricing: dict | None
    versions: list[VersionSummary]
    # For a version made by "change it in words": {"changes": ["Day 2 afternoon: Hawa Mahal → free time", ...]}.
    revision: dict | None = None


class ShareOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    view_count: int
    # Only in the response that creates the link: the database keeps just its hash.
    token: str | None = None


class SharedTripOut(BaseModel):
    title: str
    query: str
    plan: dict
    shared_by: str
    saved_at: datetime


class ReviseIn(BaseModel):
    instruction: str = Field(min_length=1, max_length=500)
