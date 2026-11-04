"""
Search by meaning, with the embedding model (qwen3-embedding). "Somewhere quiet by the sea"
finds Andaman or a Goa trip without sharing a word. Without Ollama, search falls back to
plain word matching, and says so (`mode`).

Destination vectors are saved in destinations.embedding the first time they're needed.
Trip vectors are made per search (an account has tens of trips, one batch call).
"""

import math

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.llm.gateway import Gateway
from app.models import Destination, PlanVersion, Trip, User
from app.services.saved_trips import _current, summary

MAX_RESULTS = 10


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


def _trip_text(trip: Trip) -> str:
    v = _current(trip)
    titles = sorted({i.title for i in v.items})
    plan = v.plan
    return ". ".join(filter(None, [trip.title, v.request_text, plan.get("destination"), ", ".join(plan.get("interests", [])), ", ".join(titles)]))


def _destination_text(d: Destination) -> str:
    return f"{d.name}, {d.state}. {d.summary} Good for {', '.join(i.label for i in d.interests)}. Places: {', '.join(p.name for p in d.places)}."


async def search_trips(db: AsyncSession, user: User, q: str, *, gateway: Gateway | None = None) -> dict:
    q = q.strip()
    if not q:
        raise AppError(422, "query_missing", "Type what you're looking for, like “quiet beach trip”.", "q")
    trips = (
        await db.scalars(
            select(Trip)
            .where(Trip.user_id == user.id, Trip.deleted_at.is_(None))
            .options(selectinload(Trip.versions).selectinload(PlanVersion.items))
            .limit(200)
        )
    ).all()
    if not trips:
        return {"mode": "meaning", "results": []}

    gateway = gateway or Gateway()
    vectors = await gateway.embed("search", [q, *(_trip_text(t) for t in trips)])
    if vectors and len(vectors) == len(trips) + 1:
        scored = sorted(((cosine(vectors[0], v), t) for v, t in zip(vectors[1:], trips)), key=lambda pair: pair[0], reverse=True)
        return {"mode": "meaning", "results": [{**(await summary(db, t)), "score": round(s, 3)} for s, t in scored[:MAX_RESULTS]]}

    # Without the model: trips whose title or request contains every word.
    words = [w.lower() for w in q.split() if len(w) > 2]
    matches = [t for t in trips if all(w in _trip_text(t).lower() for w in words)]
    return {"mode": "words", "results": [{**(await summary(db, t)), "score": None} for t in matches[:MAX_RESULTS]]}


async def _destinations_with_vectors(db: AsyncSession, gateway: Gateway) -> list[Destination]:
    dests = (await db.scalars(select(Destination).options(selectinload(Destination.places), selectinload(Destination.interests)).order_by(Destination.name))).all()
    missing = [d for d in dests if not d.embedding]
    if missing:
        vectors = await gateway.embed("search", [_destination_text(d) for d in missing])
        if vectors and len(vectors) == len(missing):
            for d, v in zip(missing, vectors):
                d.embedding = v
            await db.commit()
    return list(dests)


def _destination_out(d: Destination, score: float | None = None) -> dict:
    return {"slug": d.slug, "name": d.name, "state": d.state, "summary": d.summary, "interests": [i.slug for i in d.interests], "score": round(score, 3) if score is not None else None}


async def list_destinations(db: AsyncSession) -> list[dict]:
    dests = (await db.scalars(select(Destination).options(selectinload(Destination.interests)).order_by(Destination.name))).all()
    return [_destination_out(d) for d in dests]


# Place vectors, kept for the life of the API process (82 places, made in one call the first time).
_place_vectors: dict[tuple[str, str], list[float]] = {}


async def _place_vectors_for(dests: list[Destination], gateway: Gateway) -> dict[tuple[str, str], list[float]]:
    keys = [(str(p.id), f"{p.name}, {d.name}") for d in dests for p in d.places]
    missing = [k for k in keys if k not in _place_vectors]
    if missing:
        vectors = await gateway.embed("search", [text for _, text in missing])
        if vectors and len(vectors) == len(missing):
            _place_vectors.update(zip(missing, vectors))
    return _place_vectors


async def search_destinations(db: AsyncSession, q: str, *, gateway: Gateway | None = None) -> dict:
    """Scores each destination by its summary and by its best-matching place, half each, so
    "coral and diving" finds Andaman through its dive sites even though the summary says less."""
    q = q.strip()
    if not q:
        raise AppError(422, "query_missing", "Type what you're looking for, like “mountains and snow”.", "q")
    gateway = gateway or Gateway()
    dests = await _destinations_with_vectors(db, gateway)
    places = await _place_vectors_for(dests, gateway) if all(d.embedding for d in dests) else {}
    query_vec = await gateway.embed("search", [q]) if places else None
    if query_vec:
        qv = query_vec[0]

        def score(d: Destination) -> float:
            best_place = max((cosine(qv, places[(str(p.id), f"{p.name}, {d.name}")]) for p in d.places if (str(p.id), f"{p.name}, {d.name}") in places), default=0.0)
            return 0.5 * cosine(qv, d.embedding) + 0.5 * best_place

        scored = sorted(((score(d), d) for d in dests), key=lambda pair: pair[0], reverse=True)
        return {"mode": "meaning", "results": [_destination_out(d, s) for s, d in scored[:5]]}
    words = [w.lower() for w in q.split() if len(w) > 2]
    hits = (await db.scalars(select(Destination).options(selectinload(Destination.interests)).where(or_(*(Destination.summary.ilike(f"%{w}%") | Destination.name.ilike(f"%{w}%") for w in words))))).all() if words else []
    return {"mode": "words", "results": [_destination_out(d) for d in hits[:5]]}


async def similar_destinations(db: AsyncSession, slug: str, *, gateway: Gateway | None = None) -> dict:
    gateway = gateway or Gateway()
    dests = await _destinations_with_vectors(db, gateway)
    target = next((d for d in dests if d.slug == slug), None)
    if target is None:
        raise AppError(404, "not_found", "That destination isn't in TripMate's guide.")
    others = [d for d in dests if d.slug != slug]
    if target.embedding and all(d.embedding for d in others):
        scored = sorted(((cosine(target.embedding, d.embedding), d) for d in others), key=lambda pair: pair[0], reverse=True)
        return {"mode": "meaning", "results": [_destination_out(d, s) for s, d in scored[:3]]}
    # Without vectors: the destinations sharing the most interests.
    mine = {i.slug for i in target.interests}
    ranked = sorted(others, key=lambda d: -len(mine & {i.slug for i in d.interests}))
    return {"mode": "words", "results": [_destination_out(d) for d in ranked[:3]]}
