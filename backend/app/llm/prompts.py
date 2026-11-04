"""
Prompts and output schemas, one per AI job. Each schema is sent to Ollama as the required
JSON shape and checked again with Pydantic, so a reply is either valid or ignored.
Bump PROMPT_VERSION when a prompt changes, so runs can be compared.

The model never sees or produces prices: costs come from the catalog and Python.
"""

from typing import Literal

from pydantic import BaseModel, Field

PROMPT_VERSION = "2026-11-05.5"

Interest = Literal["adventure", "trekking", "nature", "food", "nightlife", "culture", "shopping", "beaches", "mountains", "photography", "history", "spiritual"]


# ---- Request reader -----------------------------------------------------------

class TripRequest(BaseModel):
    destination: str = Field("", max_length=80, description="The place the person wants to go, as written, or empty")
    days: int | None = Field(None, ge=1, le=60)
    travelers: int | None = Field(None, ge=1, le=50)
    budget_inr: int | None = Field(None, ge=0, le=10_000_000, description="Total budget in rupees, or null")
    interests: list[Interest] = Field(default_factory=list, max_length=12)


READ_REQUEST = """You read trip requests for TripMate, a trip planner for India.
Fill in only what the request says. Use null for anything it doesn't mention: don't guess.
- destination: the place name as written (for example "Goa", "Manali"), or "" if none
- days: the number of days; "a weekend" is 2, "a week" is 7
- travelers: how many people in total, counting the person asking. Examples:
  "with my wife" → 2, "me and my husband" → 2, "me and my 2 friends" → 3, "a family of four" → 4,
  "solo" → 1, "for 3 people" → 3. If the request doesn't say, use null.
- budget_inr: the total budget in rupees ("30k" is 30000, "1.5 lakh" is 150000)
- interests: only from the allowed list, matching what the request asks for"""


# ---- Activities ---------------------------------------------------------------

class PlaceChoice(BaseModel):
    place_ids: list[str] = Field(max_length=20, description="IDs from the list, best first")


PICK_ACTIVITIES = """You choose things to do for a TripMate trip.
You get the traveller's interests, the number of days, and a numbered list of places with tags.
Return the IDs of the places that fit the interests best, best first, using only IDs from the list.
Choose about two per day. Prefer variety: don't pick only one kind of place."""


# ---- Itinerary ----------------------------------------------------------------

class DayPlan(BaseModel):
    day: int = Field(ge=1, le=60)
    morning: str = Field(description="A place ID from the list, or \"free\"")
    afternoon: str = Field(description="A place ID from the list, or \"free\"")
    evening: str = Field(description="A place ID from the list, or \"free\"")


class Itinerary(BaseModel):
    days: list[DayPlan] = Field(max_length=60)


ARRANGE_DAYS = """You arrange a TripMate itinerary.
You get the number of days and the chosen places, each with an ID, a kind (activity or food) and how many hours it takes.
For each day, put one place ID (or "free") in the morning, the afternoon and the evening.
Rules:
- Use only IDs from the list, and each ID at most once.
- Put food places in the evening.
- Put a place with "sunset" in its name in the evening, and one with "sunrise" in the morning.
- Put long activities (3 hours or more) in the morning or afternoon.
- Spread the activities across the days; it's fine to leave a slot "free".
- Return exactly one entry per day, numbered from 1."""


# ---- Decisions (tev1) -----------------------------------------------------------

# Yes/no questions are answered as the probability of yes.
IS_TRIP_REQUEST = {"q1": {"type": "noul", "instructions": "Is this a request to plan a trip or holiday?"}}


# ---- Reviser: change a plan in words --------------------------------------------

Slot = Literal["morning", "afternoon", "evening"]


class Edit(BaseModel):
    action: Literal["remove", "replace", "add", "move"]
    item_id: str = Field("", description="For remove, replace and move: an item ID like i3")
    place_id: str = Field("", description='For replace and add: a place ID like p2, or "free" for free time')
    day: int | None = Field(None, ge=1, le=60, description="For add and move: the day")
    slot: Slot | None = Field(None, description="For add and move: the part of the day")


class Revision(BaseModel):
    edits: list[Edit] = Field(max_length=12)


REVISE_PLAN = """You change a TripMate itinerary to follow the traveller's instruction.
You get the current items, each with an ID like i3, its day, part of the day and title,
and places that can be added, each with an ID like p2 (none of them is in the plan yet).
Return only the edits the instruction asks for, and leave everything else alone.
- remove: take item i? out of the plan
- replace: put place p? in item i?'s place, or "free" for free time
- add: put place p? on a day and part of the day
- move: move item i? to a day and part of the day
If the instruction names a day, only change that day.
"More relaxed" or "lighter" means replacing one activity on that day with "free".
"Swap X for Y" means replace the item named X with the place named Y.
Food places belong in the evening."""

# This wording tested best on tev1:0.8b: real edits score 0.36–0.94, a weather question 0.05.
IS_PLAN_CHANGE = {"q1": {"type": "noul", "instructions": "Does this ask to change a travel plan, for example making a day lighter or busier, or adding, removing, swapping or moving something?"}}
