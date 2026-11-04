"""
Database fixtures. Tests that need PostgreSQL use the `db` fixture, which runs against
TEST_DATABASE_URL (tripmate_test), never the main database. The schema is migrated once
per run with Alembic, so the tests also prove the migration matches the models. Each
test starts from empty tables. Without PostgreSQL those tests are skipped, not failed.
"""

import subprocess
import sys
from pathlib import Path

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.base import Base
from app.db.session import get_session
from app.services import trip_service
from app.main import app
from app.services import mail

BACKEND = Path(__file__).resolve().parent.parent / "backend"

# Tests plan with rules only, so they're fast and don't depend on Ollama. Tests that cover the
# AI paths switch it back on and fake the model (test_ai_planning.py); one optional test uses the
# real models when RUN_OLLAMA_TESTS=1.
settings.ai_enabled = False


@pytest.fixture(autouse=True)
def empty_caches():
    """Each test starts with empty caches: the database is emptied between tests, so cached IDs would be stale."""
    from app.llm import gateway

    for cache in (trip_service.catalog_cache, gateway.answers, gateway.vectors):
        cache.clear()


@pytest.fixture(autouse=True)
def planner_uses_the_test_database(monkeypatch):
    """Every test, including ones that call the planner directly, records runs and reads the catalog
    in tripmate_test, never the main database."""
    engine = create_async_engine(settings.test_database_url, poolclass=NullPool)
    monkeypatch.setattr(trip_service, "SessionLocal", async_sessionmaker(engine, expire_on_commit=False))


@pytest.fixture(scope="session")
def migrated_test_db() -> str:
    url = settings.test_database_url
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-x", f"url={url}", "upgrade", "head"], cwd=BACKEND, capture_output=True, text=True
    )
    if result.returncode != 0:
        pytest.skip(f"PostgreSQL test database unavailable ({url}): {result.stderr.strip().splitlines()[-1:]}")
    return url


@pytest_asyncio.fixture
async def db(migrated_test_db) -> AsyncSession:
    # NullPool: a fresh connection per test, so nothing leaks between pytest-asyncio's event loops.
    engine = create_async_engine(migrated_test_db, poolclass=NullPool)
    async with engine.begin() as conn:
        tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
        await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    async with AsyncSession(engine, expire_on_commit=False) as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def api(db):
    """An HTTP client for the app, on the test database, keeping cookies like a browser. Starts with an empty outbox."""
    engine = create_async_engine(settings.test_database_url, poolclass=NullPool)
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async def test_session():
        async with sessions() as session:
            yield session

    app.dependency_overrides[get_session] = test_session
    real_sessions, trip_service.SessionLocal = trip_service.SessionLocal, sessions  # planner lookups and run records too
    mail.outbox.clear()
    transport = httpx.ASGITransport(app=app, client=("127.0.0.1", 50000))
    async with httpx.AsyncClient(transport=transport, base_url="http://localhost") as client:
        yield client
    app.dependency_overrides.pop(get_session, None)
    trip_service.SessionLocal = real_sessions
    await engine.dispose()
