"""Price estimates that follow the calendar and the group, and the cache for repeated lookups."""

import time
from datetime import date

import pytest

from app.core.cache import MISS, TTLCache
from app.llm import gateway as gw
from app.llm import prompts
from app.llm.gateway import Gateway
from app.pricing.heuristics import estimate

TODAY = date(2026, 11, 5)


def total(e) -> float:
    return min(o["estimated_cost"] for o in e.getting_there) + e.local_travel + e.stays[0]["estimated_total"]


# ---- Prices ------------------------------------------------------------------


def test_peak_season_costs_more_than_off_season():
    peak = estimate("Goa", 4, 2, date(2027, 1, 12), date(2027, 1, 15), today=TODAY)
    off = estimate("Goa", 4, 2, date(2027, 7, 13), date(2027, 7, 16), today=TODAY)
    assert peak.stays[0]["estimated_total"] > off.stays[0]["estimated_total"] * 1.3
    assert any("peak season" in n for n in peak.notes) and any("off season" in n for n in off.notes)


def test_christmas_week_costs_more_than_a_week_before():
    christmas = estimate("Goa", 4, 2, date(2026, 12, 24), date(2026, 12, 27), today=TODAY)
    before = estimate("Goa", 4, 2, date(2026, 12, 10), date(2026, 12, 13), today=TODAY)
    assert christmas.stays[0]["estimated_total"] > before.stays[0]["estimated_total"] * 1.3
    assert christmas.getting_there[-1]["estimated_cost"] > before.getting_there[-1]["estimated_cost"]
    assert any("Christmas" in n for n in christmas.notes)


def test_booking_late_raises_fares():
    late = estimate("Jaipur", 3, 2, date(2026, 11, 12), date(2026, 11, 14), today=TODAY)
    early = estimate("Jaipur", 3, 2, date(2027, 1, 20), date(2027, 1, 22), today=TODAY)
    assert late.getting_there[-1]["estimated_cost"] > early.getting_there[-1]["estimated_cost"]
    assert any("days ahead" in n for n in late.notes)


def test_weekend_nights_cost_more():
    weekend = estimate("Hampi", 3, 2, date(2027, 1, 22), date(2027, 1, 24), today=TODAY)  # Fri, Sat nights
    weekday = estimate("Hampi", 3, 2, date(2027, 1, 18), date(2027, 1, 20), today=TODAY)  # Mon, Tue nights
    assert weekend.stays[0]["estimated_total"] > weekday.stays[0]["estimated_total"]


def test_groups_share_rooms_and_cabs():
    two = estimate("Manali", 5, 2, today=TODAY)
    four = estimate("Manali", 5, 4, today=TODAY)
    three = estimate("Manali", 5, 3, today=TODAY)
    assert four.stays[0]["rooms"] == 2 and three.stays[0]["rooms"] == 1  # three share, with an extra bed
    assert two.stays[0]["estimated_total"] < three.stays[0]["estimated_total"] < four.stays[0]["estimated_total"]
    assert four.local_travel < two.local_travel * 2  # shared cabs


def test_islands_have_no_train_option():
    e = estimate("Andaman", 6, 2, today=TODAY)
    assert [o["mode"] for o in e.getting_there] == ["Flight"]


def test_estimates_are_in_a_realistic_range():
    # A mid-range 4-day Goa trip for two in January: getting there by train, budget rooms, local travel.
    e = estimate("Goa", 4, 2, date(2027, 1, 12), date(2027, 1, 15), today=TODAY)
    assert 15_000 < total(e) < 35_000
    assert 2_000 < e.stays[0]["nightly_rate"] < 4_000


def test_undated_trips_say_so():
    assert any("ordinary week" in n for n in estimate("Udaipur", 3, 2, today=TODAY).notes)


# ---- Cache ------------------------------------------------------------------


def test_cache_expires_and_keeps_the_most_recent():
    cache = TTLCache(size=2, ttl=0.05)
    cache.set("a", 1)
    cache.set("b", 2)
    assert cache.get("a") == 1
    cache.set("c", 3)  # "b" was used least recently
    assert cache.get("b") is MISS and cache.get("a") == 1
    time.sleep(0.06)
    assert cache.get("a") is MISS
    assert cache.stats()["hits"] == 2


@pytest.mark.asyncio
async def test_a_repeated_question_doesnt_reach_the_model(monkeypatch):
    sent = []

    async def fake_post(self, path, body, timeout):
        sent.append(path)
        if path == "/api/embed":
            return {"embeddings": [[float(len(t))] for t in body["input"]]}, None
        return {"message": {"content": '{"destination": "Goa", "days": 4, "travelers": 2, "budget_inr": null, "interests": []}'}}, None

    monkeypatch.setattr(Gateway, "_post", fake_post)
    for _ in range(3):
        g = Gateway(enabled=True)
        reply = await g.extract("planner", prompts.TripRequest, prompts.READ_REQUEST, "Request: 4 days in Goa for 2")
        assert reply.destination == "Goa"
    assert sent == ["/api/chat"] and g.summary()["cached"] == 1

    g = Gateway(enabled=True)
    await g.embed("search", ["beach", "hills"])
    await g.embed("search", ["beach", "forts"])  # only "forts" is new
    assert sent.count("/api/embed") == 2
    assert gw.vectors.stats()["entries"] == 3
