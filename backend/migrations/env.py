"""Alembic environment: runs migrations over the async engine.

The database comes from settings.database_url, or `-x url=...` to point elsewhere
(the test suite uses that for tripmate_test).
"""

import asyncio

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.core.config import settings
from app.db.base import Base

target_metadata = Base.metadata


def database_url() -> str:
    return context.get_x_argument(as_dictionary=True).get("url") or settings.database_url


def run_offline() -> None:
    context.configure(url=database_url(), target_metadata=target_metadata, literal_binds=True, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


def _run(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_online() -> None:
    engine = create_async_engine(database_url())
    async with engine.connect() as connection:
        await connection.run_sync(_run)
    await engine.dispose()


if context.is_offline_mode():
    run_offline()
else:
    asyncio.run(run_online())
