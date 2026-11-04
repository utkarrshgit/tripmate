"""
Database fixtures. Tests that need PostgreSQL use the `db` fixture, which runs against
TEST_DATABASE_URL (tripmate_test), never the main database. The schema is migrated once
per run with Alembic, so the tests also prove the migration matches the models. Each
test starts from empty tables. Without PostgreSQL those tests are skipped, not failed.
"""

import subprocess
import sys
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.db.base import Base

BACKEND = Path(__file__).resolve().parent.parent / "backend"


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
