"""Search by meaning: your trips (signed in), and TripMate's destinations (open to anyone).

Each answer says how it searched: "meaning" (the embedding model) or "words" (Ollama is off).
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DB, Current, current
from app.services import search_service

router = APIRouter(tags=["search"])


@router.get("/search/trips")
async def search_trips(q: str = Query(..., max_length=200), cur: Current = Depends(current), db: AsyncSession = DB):
    return await search_service.search_trips(db, cur.user, q)


@router.get("/destinations")
async def destinations(db: AsyncSession = DB):
    return await search_service.list_destinations(db)


@router.get("/destinations/search")
async def search_destinations(q: str = Query(..., max_length=200), db: AsyncSession = DB):
    return await search_service.search_destinations(db, q)


@router.get("/destinations/{slug}/similar")
async def similar(slug: str, db: AsyncSession = DB):
    return await search_service.similar_destinations(db, slug)
