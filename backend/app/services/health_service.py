"""What /health reports: the API, the database, and whether Ollama has the three models."""

import httpx
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine


async def database_status() -> dict:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            revision = (await conn.execute(text("SELECT version_num FROM alembic_version"))).scalar_one_or_none()
        return {"ok": True, "migration": revision}
    except Exception as exc:  # unreachable, missing database, or migrations not run
        return {"ok": False, "error": type(exc).__name__}


async def ollama_status() -> dict:
    """Which of the configured models are installed, and which are loaded in memory right now."""
    base = settings.ollama_base_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=2) as client:
            installed = {m["name"] for m in (await client.get(f"{base}/api/tags")).json().get("models", [])}
            loaded = {m["name"] for m in (await client.get(f"{base}/api/ps")).json().get("models", [])}
    except Exception as exc:
        return {"ok": False, "error": type(exc).__name__, "models": {}}

    def has(name: str, names: set[str]) -> bool:
        return name in names or f"{name}:latest" in names

    models = {
        role: {"name": name, "installed": has(name, installed), "loaded": has(name, loaded)}
        for role, name in settings.ollama_models.items()
    }
    return {"ok": all(m["installed"] for m in models.values()), "models": models}


async def check_health() -> dict:
    db = await database_status()
    ollama = await ollama_status()
    from app.llm.gateway import answers, vectors
    from app.services.trip_service import catalog_cache

    return {
        "status": "ok" if db["ok"] and ollama["ok"] else "degraded",
        "service": settings.app_name,
        "ai_enabled": settings.ai_enabled,
        "database": db,
        "ollama": ollama,
        "cache": {"model_answers": answers.stats(), "vectors": vectors.stats(), "catalog": catalog_cache.stats()},
    }
