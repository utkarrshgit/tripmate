"""
The AI paths in the planner, with a fake model that returns scripted replies, plus one
optional test against the real Ollama models (RUN_OLLAMA_TESTS=1).

What matters: the model's answer is used when it holds up, ignored when it doesn't
(invented places, unknown IDs, out-of-range numbers), and the plan never depends on it.
"""

import json
import os

import pytest
from sqlalchemy import func, select

from app.agents.activity_agent import ActivityAgent
from app.agents.context import RunContext
from app.agents.itinerary_agent import ItineraryAgent
from app.agents.planner import PlannerAgent
from app.core.config import settings
from app.db.seed import seed_catalog
from app.llm import prompts
from app.llm.gateway import Call, Gateway
from app.models import AgentRun, LlmCall
from app.services import trip_service as planning
from tests.test_accounts import V1, signed_up

pytestmark = pytest.mark.asyncio


class FakeGateway(Gateway):
    """Answers from a script: {agent: reply or callable(prompt) -> reply}. A missing agent answers None (a fallback)."""

    def __init__(self, script=None, decisions=None):
        super().__init__(enabled=True)
        self.script = script or {}
        self.decisions = decisions or {}
        self.prompts = {}

    async def extract(self, agent, schema, system, prompt, *, timeout=45):
        self.prompts[agent] = prompt
        reply = self.script.get(agent)
        reply = reply(prompt) if callable(reply) else reply
        if reply is None:
            self.calls.append(Call(agent, settings.ollama_llm_model, "extract", False, 5, error="scripted fallback"))
            return None
        self.calls.append(Call(agent, settings.ollama_llm_model, "extract", True, 5, 100, 20))
        return schema.model_validate(reply)

    async def decide(self, agent, state, questions, *, timeout=20):
        if agent not in self.decisions:
            return None
        self.calls.append(Call(agent, settings.ollama_decision_model, "decide", True, 3, 50, 0))
        return {"q1": {"type": "noul", "noul": self.decisions[agent]}}


def ctx(**kw):
    return RunContext(gateway=FakeGateway(**kw))


# ---- Request reader ----------------------------------------------------------


async def test_the_model_reads_what_rules_miss():
    query = "weekend getaway to goa with my wife, budget 25,000 rupees, beaches + nightlife"
    reply = {"destination": "Goa", "days": 2, "travelers": 2, "budget_inr": 25000, "interests": ["beaches", "nightlife"]}
    state = await PlannerAgent().run({"user_query": query}, ctx(script={"planner": reply}))
    assert (state["destination"], state["days"], state["travelers"], state["budget"]) == ("Goa", 2, 2, 25000)
    # The rules alone would have said 3 days: "weekend" is the model's catch.
    rules = await PlannerAgent().run({"user_query": query}, ctx())
    assert rules["days"] == 3 and rules["travelers"] == 2


async def test_an_invented_destination_is_ignored():
    reply = {"destination": "Paris", "days": 4, "travelers": 2, "budget_inr": None, "interests": []}
    state = await PlannerAgent().run({"user_query": "4 days in Goa for 2 people"}, ctx(script={"planner": reply}))
    assert state["destination"] == "Goa"


async def test_form_dates_beat_the_model_on_trip_length():
    reply = {"destination": "Goa", "days": 9, "travelers": 2, "budget_inr": None, "interests": []}
    state = {"user_query": "9 days in Goa for 2", "start_date": "2026-12-10", "end_date": "2026-12-13"}
    state = await PlannerAgent().run(state, ctx(script={"planner": reply}))
    assert state["days"] == 4


async def test_the_decision_model_flags_requests_that_arent_trips():
    state = await PlannerAgent().run({"user_query": "write me a poem about cats"}, ctx(decisions={"planner": 0.03}))
    assert any("doesn't look like a trip request" in i for i in state["issues"])
    state = await PlannerAgent().run({"user_query": "4 days in Goa"}, ctx(decisions={"planner": 0.97}))
    assert not state.get("issues")


# ---- Activities and days -----------------------------------------------------

CATALOG = {
    "destination": {"name": "Hampi", "state": "Karnataka", "summary": "Ruins.", "best_months": [11], "interests": ["history"]},
    "places": [
        {"id": "a1", "kind": "activity", "name": "Virupaksha Temple", "est_cost": 0, "duration_hours": 1.5, "tags": ["history", "spiritual"]},
        {"id": "a2", "kind": "activity", "name": "Vittala Temple", "est_cost": 40, "duration_hours": 2, "tags": ["history", "photography"]},
        {"id": "a3", "kind": "activity", "name": "Matanga Hill", "est_cost": 0, "duration_hours": 2, "tags": ["trekking"]},
        {"id": "a4", "kind": "activity", "name": "Coracle ride", "est_cost": 300, "duration_hours": 1, "tags": ["adventure"]},
        {"id": "f1", "kind": "food", "name": "Mango Tree", "est_cost": 400, "duration_hours": 1, "tags": ["food"]},
    ],
}


def hampi_ctx(**kw):
    c = ctx(**kw)
    c.catalog = CATALOG
    return c


async def test_the_model_picks_places_but_only_from_the_catalog():
    c = hampi_ctx(script={"activity": {"place_ids": ["a3", "not-a-place", "a2", "a3"]}})
    state = await ActivityAgent().run({"days": 1, "travelers": 2, "interests": ["trekking"]}, c)
    assert [a["name"] for a in state["activities"]] == ["Matanga Hill", "Vittala Temple"]
    assert state["activities"][1]["estimated_cost"] == 80  # catalog cost × 2 people, not the model's
    assert "Virupaksha Temple" in c.gateway.prompts["activity"]


async def test_activities_fall_back_to_matching_tags():
    state = await ActivityAgent().run({"days": 1, "travelers": 1, "interests": ["photography"]}, hampi_ctx())
    assert state["activities"][0]["name"] == "Vittala Temple"


async def test_the_model_orders_the_days_and_bad_slots_are_dropped():
    activities = [{"name": p["name"], "place_id": p["id"], "estimated_cost": 0, "duration_hours": p["duration_hours"]} for p in CATALOG["places"][:3]]
    food = [{"name": "Mango Tree", "place_id": "f1"}]
    layout = {"days": [
        {"day": 1, "morning": "a2", "afternoon": "a1", "evening": "f1"},
        {"day": 2, "morning": "a2", "afternoon": "made-up", "evening": "free"},  # a2 again and an unknown ID
    ]}
    state = {"days": 2, "destination": "Hampi", "activities": activities, "food_places": food}
    state = await ItineraryAgent().run(state, hampi_ctx(script={"itinerary": layout}))
    day1, day2 = state["itinerary"]
    assert (day1["morning"], day1["afternoon"], day1["evening"]) == ("Vittala Temple", "Virupaksha Temple", "Mango Tree")
    # The model left Matanga Hill out and day 2 empty: it's moved into day 2's afternoon.
    assert day2["morning"].startswith("Breakfast") and day2["afternoon"] == "Matanga Hill"


async def test_days_fall_back_to_the_rule_layout():
    activities = [{"name": p["name"], "place_id": p["id"], "estimated_cost": 0} for p in CATALOG["places"][:2]]
    state = {"days": 2, "destination": "Hampi", "activities": activities, "food_places": [{"name": "Mango Tree", "place_id": "f1"}]}
    state = await ItineraryAgent().run(state, hampi_ctx())
    assert [d["afternoon"] for d in state["itinerary"]] == ["Virupaksha Temple", "Vittala Temple"]
    assert all(d["evening"] == "Mango Tree" for d in state["itinerary"])


# ---- Whole runs --------------------------------------------------------------


async def test_a_whole_plan_uses_the_catalog_and_is_recorded(api, db):
    await seed_catalog(db)
    gateway = FakeGateway(
        script={
            "planner": {"destination": "Hampi", "days": 2, "travelers": 2, "budget_inr": 12000, "interests": ["history"]},
            "activity": lambda prompt: {"place_ids": [line.split(":")[0] for line in prompt.splitlines() if "Temple" in line]},
        },
        decisions={"planner": 0.98},
    )
    result = await planning.trip_service.plan_trip("2 days in Hampi for 2 people under 12000, history", gateway=gateway)
    assert result["destination_info"]["in_catalog"]
    # The model's picks come first; the tag ranking tops up to about two a day.
    assert [a["name"] for a in result["activities"][:2]] == ["Virupaksha Temple", "Vittala Temple and the Stone Chariot"]
    assert len(result["activities"]) == 4
    assert result["food_places"][0]["name"] == "Mango Tree"
    assert result["ai"]["used"] and "itinerary" in result["ai"]["fell_back"]  # no itinerary script: rules laid out the days
    assert result["run_id"]
    assert await db.scalar(select(func.count()).select_from(LlmCall)) == len(gateway.calls)
    assert (await db.scalar(select(AgentRun))).status == "done"


async def test_planning_works_with_ollama_switched_off(api, monkeypatch):
    monkeypatch.setattr(settings, "ai_enabled", True)
    monkeypatch.setattr(settings, "ollama_base_url", "http://127.0.0.1:9")  # nothing listens here
    res = await api.post(f"{V1}/plans", json={"query": "4 days in Goa for 2 people"})
    assert res.status_code == 200
    plan = res.json()
    assert plan["destination"] == "Goa" and len(plan["itinerary"]) == 4
    assert plan["ai"]["used"] is False and plan["ai"]["calls"] == 1  # one failed try, then the run stops asking


async def test_the_stream_reports_every_agent_then_the_plan(api, db):
    await signed_up(api)
    async with api.stream("POST", f"{V1}/plans/stream", json={"query": "3 days in Jaipur for 2 people, history"}) as res:
        assert res.headers["content-type"].startswith("text/event-stream")
        events = []
        name = None
        async for line in res.aiter_lines():
            if line.startswith("event: "):
                name = line[7:]
            elif line.startswith("data: "):
                events.append((name, json.loads(line[6:])))
    steps = [e for n, e in events if n == "step"]
    assert [s["agent"] for s in steps if s["phase"] == "done"] == ["planner", "destination", "transport", "hotel", "activity", "food", "budget", "itinerary", "critic"]
    assert steps[0]["phase"] == "start" and steps[1]["summary"].startswith("Jaipur")
    name, plan = events[-1]
    assert name == "result" and plan["destination"] == "Jaipur"
    run = await db.scalar(select(AgentRun))
    assert run.user_id is not None  # a signed-in run is recorded against the account


# ---- Real models (optional) --------------------------------------------------


@pytest.mark.skipif(os.environ.get("RUN_OLLAMA_TESTS") != "1", reason="set RUN_OLLAMA_TESTS=1 to use the real Ollama models")
async def test_real_models_read_a_request():
    gateway = Gateway(enabled=True)
    reply = await gateway.extract("planner", prompts.TripRequest, prompts.READ_REQUEST, "Request: 5 days in Manali for me and my 2 friends, under 30k, trekking")
    assert reply is not None and reply.destination.lower() == "manali" and reply.days == 5 and reply.travelers == 3
    answers = await gateway.decide("planner", "5 days in Manali", prompts.IS_TRIP_REQUEST)
    assert answers["q1"]["noul"] > 0.5


async def test_sunset_and_sunrise_places_move_to_the_right_time():
    layout = {1: {"morning": "Nahargarh Fort at sunset", "afternoon": "City Palace", "evening": "Chokhi Dhani"}, 2: {"afternoon": "Sunrise at Tiger Hill"}}
    ItineraryAgent._respect_time_of_day(layout)
    assert layout[1]["evening"] == "Nahargarh Fort at sunset" and layout[1]["morning"] == "Chokhi Dhani"
    assert layout[2]["morning"] == "Sunrise at Tiger Hill" and not layout[2]["afternoon"]
