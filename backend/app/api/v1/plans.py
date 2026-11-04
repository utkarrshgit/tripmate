"""/api/v1/plans: plan a trip, open to everyone. /plans/stream sends live progress as it plans.

The stream is Server-Sent Events, one JSON object per event:
  event: step     {"agent": "planner", "phase": "start" | "done", "ai": bool, "fell_back": bool, "models": [...], "summary": "..."}
  event: result   the plan (the same shape as POST /plans)
  event: error    {"message": "..."}
"""

import asyncio
import json

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.logger import get_logger
from app.schemas.trip import TripRequest, TripResponse
from app.services import trip_service as planning
from app.services.auth_service import session_for_token

router = APIRouter(prefix="/plans", tags=["planning"])
logger = get_logger("plans")


async def _user_id(request: Request):
    """The signed-in user, if any: planning is open, but a signed-in run is recorded against the account."""
    try:
        async with planning.SessionLocal() as db:
            session = await session_for_token(db, request.cookies.get(settings.session_cookie))
            return session.user_id if session else None
    except Exception:  # noqa: BLE001 - no database: plan anyway
        return None


def _event(name: str, data: dict) -> str:
    return f"event: {name}\ndata: {json.dumps(data, default=str)}\n\n"


@router.post("", response_model=TripResponse)
async def plan(body: TripRequest, request: Request):
    return await planning.trip_service.plan_trip(body.query, start_date=body.start_date, end_date=body.end_date, user_id=await _user_id(request))


@router.post("/stream")
async def plan_stream(body: TripRequest, request: Request):
    user_id = await _user_id(request)
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def progress(agent: str, phase: str, details: dict) -> None:
        await queue.put(_event("step", {"agent": agent, "phase": phase, **details}))

    async def run() -> None:
        try:
            result = await planning.trip_service.plan_trip(body.query, start_date=body.start_date, end_date=body.end_date, user_id=user_id, progress=progress)
            await queue.put(_event("result", TripResponse(**result).model_dump(mode="json")))
        except Exception:  # noqa: BLE001
            logger.exception("Planning failed")
            await queue.put(_event("error", {"message": "We couldn't plan this trip. Try again."}))
        finally:
            await queue.put(None)

    async def events():
        task = asyncio.create_task(run())
        try:
            while (item := await queue.get()) is not None:
                yield item
        finally:
            task.cancel()  # the browser went away: stop planning

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
