"""Loads the catalog in seed_data.py. Safe to run again: it updates what's there and adds what's missing."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.seed_data import DESTINATIONS, INTERESTS
from app.models import Destination, Interest, Place


async def seed_catalog(session: AsyncSession) -> dict[str, int]:
    """Upserts interests by slug, destinations by slug, and each destination's places by name.

    Places added by an admin and not in the seed file are left alone.
    """
    interests = {i.slug: i for i in (await session.scalars(select(Interest))).all()}
    for slug, label in INTERESTS.items():
        if slug in interests:
            interests[slug].label = label
        else:
            interests[slug] = Interest(slug=slug, label=label)
            session.add(interests[slug])

    existing = {
        d.slug: d
        for d in (await session.scalars(select(Destination).options(selectinload(Destination.places), selectinload(Destination.interests)))).all()
    }
    places_written = 0
    for data in DESTINATIONS:
        dest = existing.get(data["slug"])
        if dest is None:
            dest = Destination(slug=data["slug"], places=[], interests=[])
            session.add(dest)
        for field in ("name", "state", "summary", "best_months", "avg_daily_cost"):
            setattr(dest, field, data[field])
        dest.interests = [interests[s] for s in data["interests"]]

        by_name = {p.name: p for p in dest.places}
        for p in data["places"]:
            row = by_name.get(p["name"])
            if row is None:
                dest.places.append(Place(**p))
            else:
                for field, value in p.items():
                    setattr(row, field, value)
            places_written += 1

    await session.commit()
    from app.services.trip_service import catalog_cache

    catalog_cache.clear()  # plans see the refreshed catalog straight away
    return {"interests": len(INTERESTS), "destinations": len(DESTINATIONS), "places": places_written}
