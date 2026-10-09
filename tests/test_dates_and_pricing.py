from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)
START = date.today() + timedelta(days=30)


def plan(**body):
    return client.post("/api/trips/plan", json={"query": "Plan a trip to Goa under ₹25000 for 2 people", **body})


def test_dates_set_trip_length_and_itinerary_dates():
    res = plan(start_date=START.isoformat(), end_date=(START + timedelta(days=3)).isoformat())
    assert res.status_code == 200
    body = res.json()
    assert body["days"] == 4
    assert body["pricing"] == "estimate"
    assert [d["date"] for d in body["itinerary"]] == [(START + timedelta(days=i)).isoformat() for i in range(4)]


def test_dates_beat_day_count_in_text():
    res = client.post(
        "/api/trips/plan",
        json={"query": "Plan a 9 day trip to Goa", "start_date": START.isoformat(), "end_date": START.isoformat()},
    )
    assert res.json()["days"] == 1


def test_plan_without_dates_still_works():
    body = plan().json()
    assert body["start_date"] is None
    assert body["itinerary"][0]["date"] is None


@pytest.mark.parametrize(
    "dates",
    [
        {"start_date": START.isoformat()},  # only one date
        {"start_date": START.isoformat(), "end_date": (START - timedelta(days=1)).isoformat()},  # end before start
        {"start_date": START.isoformat(), "end_date": (START + timedelta(days=40)).isoformat()},  # too long
    ],
)
def test_invalid_dates_are_rejected(dates):
    assert plan(**dates).status_code == 422


def price(**overrides):
    body = {
        "destination": "Goa",
        "start_date": START.isoformat(),
        "end_date": (START + timedelta(days=3)).isoformat(),
        "travelers": 2,
        "origin": "Delhi",
        **overrides,
    }
    return client.post("/api/trips/price", json=body)


def test_pricing_off_says_unavailable(monkeypatch):
    monkeypatch.setattr(settings, "pricing_provider", "none")
    body = price().json()
    assert body["status"] == "unavailable"
    assert body["transport"] == [] and body["stays"] == []


def test_sample_pricing_is_flagged_sorted_and_stable(monkeypatch):
    monkeypatch.setattr(settings, "pricing_provider", "sample")
    first, second = price().json(), price().json()
    assert first["status"] == "ok" and first["is_sample"] is True
    assert first["transport"] and first["stays"]
    assert [q["price"] for q in first["stays"]] == sorted(q["price"] for q in first["stays"])
    assert [q["price"] for q in first["transport"]] == [q["price"] for q in second["transport"]]


def test_sample_pricing_without_origin_skips_transport(monkeypatch):
    monkeypatch.setattr(settings, "pricing_provider", "sample")
    body = price(origin=None).json()
    assert body["transport"] == [] and body["stays"]
    assert "starting city" in body["message"]


def test_unknown_destination_never_reaches_people():
    body = client.post("/api/trips/plan", json={"query": "something fun for 2 people"}).json()
    text = str(body)
    assert body["destination"] == ""
    assert "Unknown destination" not in text
    assert "We couldn't tell where you're going" in " ".join(body["issues"])
