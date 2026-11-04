"""The demo stays true: each mock-mode prompt plans the trip it promises, and every suggested
follow-up command changes that plan (no model needed)."""

import pytest
from sqlalchemy import func, select

from app.db import demo_data
from app.db.seed import seed_catalog
from app.models import ItineraryItem, PlanVersion, Trip, User
from app.services import reviser
from app.services.trip_service import trip_service

pytestmark = pytest.mark.asyncio


@pytest.mark.parametrize("index", range(len(demo_data.PROMPTS)))
async def test_each_demo_prompt_and_its_follow_ups(index, db, api):
    await seed_catalog(db)
    prompt, _, days, _, follow_ups = demo_data.PROMPTS[index]
    start, end = demo_data.prompt_dates(index)
    plan = await trip_service.plan_trip(prompt, start_date=start, end_date=end)
    assert plan["destination_info"]["in_catalog"], prompt
    assert plan["days"] == days and not plan["issues"], (prompt, plan["issues"])

    items = [ItineraryItem(id=f"i{n}", day_no=d["day"], slot=slot, position=0, title=d[slot]) for n, (d, slot) in enumerate((d, s) for d in plan["itinerary"] for s in ("morning", "afternoon", "evening"))]
    places = {p["place_id"]: {"name": p["name"], "kind": "activity"} for p in plan["activities"]}
    for command in follow_ups:
        edits = reviser.command_edits(command, items, places)
        assert edits, f"{command!r} doesn't match the {plan['destination']} plan"


async def test_seed_demo_makes_the_account_and_trips(db, api):
    from app.cli import seed_demo

    await seed_catalog(db)
    counts = await seed_demo(db)
    assert counts["trips"] == len(demo_data.SAVED)
    user = await db.scalar(select(User).where(User.email == demo_data.DEMO_ACCOUNT["email"]))
    assert user.role == "admin" and user.email_verified_at
    assert await db.scalar(select(func.count()).select_from(Trip).where(Trip.user_id == user.id)) == len(demo_data.SAVED)
    assert await db.scalar(select(func.count()).select_from(PlanVersion)) == len(demo_data.SAVED) + 1  # one trip already changed in words
    again = await seed_demo(db)  # safe to run again: starts the demo account over
    assert again == counts
    res = await api.post("/api/v1/auth/login", json={"email": demo_data.DEMO_ACCOUNT["email"], "password": demo_data.DEMO_ACCOUNT["password"]})
    assert res.status_code == 200
