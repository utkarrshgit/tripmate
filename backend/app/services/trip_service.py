"""
Runs the planner: one Gateway per run (so each run has its own model calls), the catalog
from PostgreSQL, live progress for streaming, and a record of the run and every model call.
The database is optional here: without it, plans still work, just without the catalog or records.
"""

import time
import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.agents.context import Progress, RunContext, _no_progress
from app.agents.supervisor import SupervisorAgent
from app.core.logger import get_logger
from app.db.session import SessionLocal
from app.llm.gateway import Gateway
from app.models import AgentRun, Destination, LlmCall

logger = get_logger("trips")


async def load_catalog(name: str) -> dict | None:
    """The destination and its places, matched by name or slug, or None (also when the database is down)."""
    key = name.strip().lower()
    try:
        async with SessionLocal() as db:
            dest = await db.scalar(
                select(Destination)
                .where((func.lower(Destination.name) == key) | (Destination.slug == key.replace(" ", "-")))
                .options(selectinload(Destination.places), selectinload(Destination.interests))
            )
    except Exception as exc:  # noqa: BLE001 - planning must never fail because of the catalog
        logger.warning("Catalog unavailable (%s); planning without it", type(exc).__name__)
        return None
    if dest is None:
        return None
    return {
        "destination": {
            "name": dest.name,
            "state": dest.state,
            "summary": dest.summary,
            "best_months": list(dest.best_months),
            "interests": [i.slug for i in dest.interests],
        },
        "places": [
            {"id": str(p.id), "kind": p.kind, "name": p.name, "est_cost": float(p.est_cost), "duration_hours": float(p.duration_hours), "tags": list(p.tags)}
            for p in sorted(dest.places, key=lambda p: p.name)
        ],
    }


def to_response(result: dict, run_id: uuid.UUID | None) -> dict:
    """The planner's state as the website reads it (POST /api/trips/plan's TripResponse)."""
    return {
        "destination": result.get("destination", ""),
        "days": result.get("days", 0),
        "travelers": result.get("travelers", 1),
        "budget": result.get("budget", 0),
        "total_cost": result.get("total_cost", 0),
        "itinerary": result.get("itinerary", []),
        "issues": result.get("issues", []),
        "completed_agents": result.get("completed_agents", []),
        "final_response": result.get("final_response", ""),
        "start_date": result.get("start_date"),
        "end_date": result.get("end_date"),
        "interests": result.get("interests", []),
        "destination_info": result.get("destination_info", {}),
        "transport_options": result.get("transport_options", []),
        "hotel_options": result.get("hotel_options", []),
        "activities": result.get("activities", []),
        "food_options": result.get("food_options", []),
        "food_places": result.get("food_places", []),
        "cost_breakdown": {
            "transport": result.get("estimated_transport_cost", 0),
            "hotel": result.get("estimated_hotel_cost", 0),
            "activities": result.get("estimated_activity_cost", 0),
            "food": result.get("estimated_food_cost", 0),
        },
        "ai": result.get("ai", {}),
        "run_id": str(run_id) if run_id else None,
    }


async def _record(query: str, user_id, gateway: Gateway, ms: int, status: str) -> uuid.UUID | None:
    try:
        async with SessionLocal() as db:
            run = AgentRun(user_id=user_id, request_text=query[:2000], status=status, duration_ms=ms)
            db.add(run)
            await db.flush()
            db.add_all(
                LlmCall(run_id=run.id, agent=c.agent, model=c.model, prompt_tokens=c.prompt_tokens, output_tokens=c.output_tokens, latency_ms=c.latency_ms, ok=c.ok)
                for c in gateway.calls
            )
            await db.commit()
            return run.id
    except Exception as exc:  # noqa: BLE001 - a missing record mustn't lose the plan
        logger.warning("Couldn't record the planning run (%s)", type(exc).__name__)
        return None


class TripService:
    def __init__(self):
        self.supervisor = SupervisorAgent()

    async def plan_trip(
        self,
        query: str,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
        user_id=None,
        progress: Progress = _no_progress,
        gateway: Gateway | None = None,
    ) -> dict:
        gateway = gateway or Gateway()
        ctx = RunContext(gateway=gateway, load_catalog=load_catalog, progress=progress)
        started = time.perf_counter()
        try:
            result = await self.supervisor.run(query, start_date=start_date, end_date=end_date, ctx=ctx)
        except Exception:
            await _record(query, user_id, gateway, int((time.perf_counter() - started) * 1000), "failed")
            raise
        run_id = await _record(query, user_id, gateway, int((time.perf_counter() - started) * 1000), "done")
        return to_response(result, run_id)


# One planner for the whole app (the agents keep no per-run state).
trip_service = TripService()
