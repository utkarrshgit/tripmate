from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from app.llm.gateway import Gateway

# Called before and after each agent: progress(agent_name, "start" | "done", details).
Progress = Callable[[str, str, dict], Awaitable[None]]
# Looks up a destination's catalog entry and places by name; None when it isn't in the catalog.
CatalogLoader = Callable[[str], Awaitable[dict | None]]


async def _no_progress(_agent: str, _phase: str, _details: dict) -> None:
    return None


async def _no_catalog(_name: str) -> dict | None:
    return None


@dataclass
class RunContext:
    """What a planning run gives its agents besides the shared state."""

    gateway: Gateway = field(default_factory=Gateway)
    load_catalog: CatalogLoader = _no_catalog
    progress: Progress = _no_progress
    # Filled by the destination agent: {"destination": {...}, "places": [...]} or None.
    catalog: dict | None = None
    # Filled by the transport agent: the run's price estimate (app/pricing/heuristics.py).
    estimate: object | None = None
