"""The model activity page: how the local models performed, from agent_runs and llm_calls."""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import AgentRun, LlmCall


def _p95(values: list[int]) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, round(0.95 * (len(ordered) - 1)))]


async def ai_activity(db: AsyncSession, days: int) -> dict:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    runs = (await db.scalars(select(AgentRun).where(AgentRun.created_at >= since).options(selectinload(AgentRun.calls)).order_by(AgentRun.created_at.desc()))).all()
    calls: list[LlmCall] = [c for r in runs for c in r.calls]

    groups: dict[tuple[str, str], list[LlmCall]] = {}
    for c in calls:
        groups.setdefault((c.agent, c.model), []).append(c)
    by_agent = [
        {
            "agent": agent,
            "model": model,
            "calls": len(cs),
            "ok": sum(c.ok for c in cs),
            "ok_rate": round(sum(c.ok for c in cs) / len(cs), 3),
            "avg_ms": round(sum(c.latency_ms for c in cs) / len(cs)),
            "p95_ms": _p95([c.latency_ms for c in cs]),
            "prompt_tokens": sum(c.prompt_tokens for c in cs),
            "output_tokens": sum(c.output_tokens for c in cs),
        }
        for (agent, model), cs in sorted(groups.items())
    ]
    with_ai = [r for r in runs if any(c.ok for c in r.calls)]
    durations = [r.duration_ms for r in runs if r.duration_ms]
    return {
        "days": days,
        "totals": {
            "runs": len(runs),
            "runs_with_ai": len(with_ai),
            "calls": len(calls),
            "ok_rate": round(sum(c.ok for c in calls) / len(calls), 3) if calls else None,
            "avg_run_ms": round(sum(durations) / len(durations)) if durations else None,
            "p95_run_ms": _p95(durations) if durations else None,
        },
        "by_agent": by_agent,
        "recent": [
            {
                "id": r.id,
                "at": r.created_at,
                "request": r.request_text,
                "status": r.status,
                "duration_ms": r.duration_ms,
                "signed_in": r.user_id is not None,
                "models": sorted({c.model for c in r.calls if c.ok}),
                "fell_back": sorted({c.agent for c in r.calls if not c.ok} - {c.agent for c in r.calls if c.ok}),
            }
            for r in runs[:25]
        ],
    }
