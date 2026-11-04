"""The schema's rules, the catalog seed, and /health."""

from datetime import date, datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, inspect, select
from sqlalchemy.exc import IntegrityError

from app.db.base import Base
from app.db.seed import seed_catalog
from app.db.seed_data import DESTINATIONS, INTERESTS
from app.main import app
from app.models import Destination, Interest, ItineraryItem, Place, PlanVersion, Session, Trip, User


def make_user(email="asha@example.test"):
    return User(email=email, name="Asha", password_hash="argon2-hash")


async def table_names(db):
    conn = await db.connection()
    return set(await conn.run_sync(lambda sync: inspect(sync).get_table_names()))


@pytest.mark.asyncio
async def test_migration_creates_every_table(db):
    assert {t.name for t in Base.metadata.sorted_tables} <= await table_names(db)
    assert len(Base.metadata.tables) == 16


@pytest.mark.asyncio
async def test_emails_are_unique_ignoring_case(db):
    db.add(make_user("Asha@Example.test"))
    await db.commit()
    assert await db.scalar(select(User).where(User.email == "asha@example.test")) is not None
    db.add(make_user("asha@EXAMPLE.test"))
    with pytest.raises(IntegrityError):
        await db.commit()


@pytest.mark.asyncio
async def test_check_constraints_reject_bad_rows(db):
    user = make_user()
    db.add(user)
    await db.commit()
    user_id = user.id  # a rollback expires loaded objects, so keep the id
    today = date.today()
    db.add(Trip(user_id=user_id, title="Goa", travelers=0, start_date=today, end_date=today))
    with pytest.raises(IntegrityError, match="ck_trips_travelers"):
        await db.commit()
    await db.rollback()
    db.add(Trip(user_id=user_id, title="Goa", start_date=today, end_date=today - timedelta(days=1)))
    with pytest.raises(IntegrityError, match="ck_trips_dates"):
        await db.commit()


@pytest.mark.asyncio
async def test_deleting_a_user_deletes_what_they_own(db):
    user = make_user()
    db.add(user)
    await db.flush()
    trip = Trip(user_id=user.id, title="Goa")
    db.add(trip)
    db.add(Session(user_id=user.id, token_hash="a" * 64, expires_at=datetime.now(timezone.utc) + timedelta(days=30)))
    await db.flush()
    version = PlanVersion(trip_id=trip.id, version_no=1, request_text="4 days in Goa", source="plan", total_cost=20000)
    db.add(version)
    await db.flush()
    db.add(ItineraryItem(version_id=version.id, day_no=1, slot="morning", title="Baga Beach"))
    trip.current_version_id = version.id  # the trips ↔ plan_versions link that's added last in the migration
    await db.commit()

    await db.delete(user)
    await db.commit()
    for model in (Trip, PlanVersion, ItineraryItem, Session):
        assert await db.scalar(select(func.count()).select_from(model)) == 0


@pytest.mark.asyncio
async def test_seed_loads_the_catalog_and_can_run_again(db):
    first = await seed_catalog(db)
    second = await seed_catalog(db)
    assert first == second
    assert await db.scalar(select(func.count()).select_from(Destination)) == len(DESTINATIONS) == 12
    assert await db.scalar(select(func.count()).select_from(Interest)) == len(INTERESTS) == 12
    assert await db.scalar(select(func.count()).select_from(Place)) == sum(len(d["places"]) for d in DESTINATIONS)


def test_seed_data_is_consistent():
    for d in DESTINATIONS:
        kinds = [p["kind"] for p in d["places"]]
        assert kinds.count("activity") >= 4 and kinds.count("food") >= 1, d["slug"]
        assert set(d["interests"]) <= INTERESTS.keys(), d["slug"]
        assert all(set(p["tags"]) <= INTERESTS.keys() for p in d["places"]), d["slug"]
        assert all(1 <= m <= 12 for m in d["best_months"]), d["slug"]
        assert len({p["name"] for p in d["places"]}) == len(d["places"]), f"duplicate place name in {d['slug']}"


def test_health_reports_database_and_models():
    body = TestClient(app).get("/health").json()
    assert body["status"] in {"ok", "degraded"}
    assert set(body["database"]) >= {"ok"}
    assert set(body["ollama"]["models"]) <= {"llm", "decision", "embedding"}
