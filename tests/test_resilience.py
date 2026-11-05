"""Nothing fails hard: break things on purpose and check the answer is still useful."""

import httpx
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.agents.activity_agent import ActivityAgent
from app.agents.itinerary_agent import ItineraryAgent
from app.db.session import get_session
from app.main import app
from app.services import trip_service

pytestmark = pytest.mark.asyncio
ORIGIN = {"Origin": "http://localhost:5173"}
NOWHERE = "postgresql+asyncpg://127.0.0.1:9/nowhere"  # nothing listens on port 9


@pytest.fixture
def client():
    transport = httpx.ASGITransport(app=app, client=("127.0.0.1", 50000))
    return httpx.AsyncClient(transport=transport, base_url="http://localhost")


@pytest.fixture
def database_down(monkeypatch):
    engine = create_async_engine(NOWHERE, poolclass=NullPool, connect_args={"timeout": 2})
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def broken_session():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_session] = broken_session
    monkeypatch.setattr(trip_service, "SessionLocal", sessions)
    from app.services import health_service

    monkeypatch.setattr(health_service, "engine", engine)
    yield
    app.dependency_overrides.pop(get_session, None)


async def test_an_unexpected_crash_still_answers_in_the_usual_shape(client, monkeypatch):
    async def explode(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(trip_service.trip_service, "plan_trip", explode)
    async with client:
        res = await client.post("/api/trips/plan", json={"query": "4 days in Goa"}, headers=ORIGIN)
    assert res.status_code == 500
    assert res.json()["error"]["code"] == "server_error" and "Try again" in res.json()["error"]["message"]
    assert res.headers["access-control-allow-origin"] == "http://localhost:5173"  # the website can read it


async def test_with_the_database_down_accounts_say_so_and_planning_still_works(client, database_down):
    async with client:
        signup = await client.post("/api/v1/auth/signup", json={"name": "A", "email": "a@example.test", "password": "trek-manali-26"}, headers=ORIGIN)
        assert signup.status_code == 503 and signup.json()["error"]["code"] == "database_unavailable"
        assert "still plan trips" in signup.json()["error"]["message"]
        assert signup.headers["access-control-allow-origin"] == "http://localhost:5173"

        destinations = await client.get("/api/v1/destinations", headers=ORIGIN)
        assert destinations.status_code == 503

        plan = await client.post("/api/v1/plans", json={"query": "4 days in Goa for 2 people"})
        assert plan.status_code == 200 and len(plan.json()["itinerary"]) == 4  # no catalog, no records: still a plan

        health = (await client.get("/health")).json()
        assert health["status"] == "degraded" and health["database"]["ok"] is False


async def test_an_agent_that_keeps_crashing_leaves_its_part_simple(client, monkeypatch):
    async def broken(self, state, ctx):
        raise ValueError("bad data")

    monkeypatch.setattr(ItineraryAgent, "run", broken)
    async with client:
        res = await client.post("/api/v1/plans", json={"query": "3 days in Jaipur for 2 people"})
    plan = res.json()
    assert res.status_code == 200 and plan["destination"] == "Jaipur" and plan["total_cost"] > 0
    assert plan["itinerary"] == []
    assert any("day-by-day plan" in issue for issue in plan["issues"])


async def test_an_agent_that_fails_with_the_model_is_retried_with_rules(client, monkeypatch):
    real_run = ActivityAgent.run

    async def fails_with_ai(self, state, ctx):
        if ctx.gateway.enabled:
            raise TimeoutError("model hung")
        return await real_run(self, state, ctx)

    monkeypatch.setattr(ActivityAgent, "run", fails_with_ai)
    from app.core.config import settings

    monkeypatch.setattr(settings, "ai_enabled", True)
    monkeypatch.setattr(settings, "ollama_base_url", "http://127.0.0.1:9")
    async with client:
        res = await client.post("/api/v1/plans", json={"query": "3 days in Jaipur for 2 people"})
    plan = res.json()
    assert res.status_code == 200 and plan["activities"]
    assert not any("things to do" in issue for issue in plan["issues"])  # the retry worked: nothing to report
