"""/api/v1/trips: your saved trips, their versions, items, exact prices and share links.

Every route needs you to be signed in, and only reaches your own trips; anyone else's
trip looks the same as a missing one (404). /api/v1/shared/{token} is open: it's the
read-only page behind a share link.
"""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DB, Current, current
from app.schemas.trips import ImportIn, ItemIn, ItemPatch, PricingIn, ShareOut, SharedTripOut, TripIn, TripOut, TripPage, TripPatch, VersionIn
from app.services import saved_trips as trips

router = APIRouter(prefix="/trips", tags=["trips"])
shared = APIRouter(tags=["shared"])


@router.post("", status_code=201, response_model=TripOut)
async def save_trip(body: TripIn, cur: Current = Depends(current), db: AsyncSession = DB):
    """Saves a planned trip (and its exact prices, if they were checked) as version 1."""
    pricing = body.pricing.model_dump() if body.pricing else None
    return await trips.create_trip(db, cur.user, body.query, body.plan.model_dump(mode="json"), pricing, body.title)


@router.post("/import")
async def import_trips(body: ImportIn, cur: Current = Depends(current), db: AsyncSession = DB):
    """Moves trips saved in a browser before accounts existed into the account."""
    items = [{"query": t.query, "plan": t.plan.model_dump(mode="json"), "pricing": t.pricing.model_dump() if t.pricing else None} for t in body.trips]
    return {"imported": await trips.import_trips(db, cur.user, items)}


@router.get("", response_model=TripPage)
async def list_trips(
    status: Literal["saved", "archived"] | None = None,
    q: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    cur: Current = Depends(current),
    db: AsyncSession = DB,
):
    return await trips.list_trips(db, cur.user, status=status, q=q, trash=False, page=page, per_page=per_page)


@router.get("/trash", response_model=TripPage)
async def list_trash(page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=100), cur: Current = Depends(current), db: AsyncSession = DB):
    """Deleted trips, kept for 30 days."""
    return await trips.list_trips(db, cur.user, status=None, q=None, trash=True, page=page, per_page=per_page)


@router.get("/{trip_id}", response_model=TripOut)
async def get_trip(trip_id: uuid.UUID, cur: Current = Depends(current), db: AsyncSession = DB):
    return await trips.get_trip(db, cur.user, trip_id)


@router.patch("/{trip_id}", response_model=TripOut)
async def update_trip(trip_id: uuid.UUID, body: TripPatch, cur: Current = Depends(current), db: AsyncSession = DB):
    """Renames the trip, or archives it."""
    return await trips.update_trip(db, cur.user, trip_id, title=body.title, status=body.status)


@router.delete("/{trip_id}", status_code=204)
async def delete_trip(trip_id: uuid.UUID, forever: bool = False, cur: Current = Depends(current), db: AsyncSession = DB):
    """Moves the trip to the trash. With ?forever=true, deletes a trip that's already in the trash."""
    if forever:
        await trips.delete_forever(db, cur.user, trip_id)
    else:
        await trips.trash_trip(db, cur.user, trip_id)
    return Response(status_code=204)


@router.post("/{trip_id}/restore", response_model=TripOut)
async def restore_trip(trip_id: uuid.UUID, cur: Current = Depends(current), db: AsyncSession = DB):
    """Brings a trip back from the trash."""
    return await trips.restore_trip(db, cur.user, trip_id)


# ---- Versions ----


@router.post("/{trip_id}/versions", status_code=201, response_model=TripOut)
async def plan_again(trip_id: uuid.UUID, body: VersionIn, cur: Current = Depends(current), db: AsyncSession = DB):
    """Saves a new plan for the trip as the next version, and shows it."""
    return await trips.add_version(db, cur.user, trip_id, body.query, body.plan.model_dump(mode="json"))


@router.get("/{trip_id}/versions/{no}")
async def get_version(trip_id: uuid.UUID, no: int, cur: Current = Depends(current), db: AsyncSession = DB):
    return await trips.get_version(db, cur.user, trip_id, no)


@router.post("/{trip_id}/versions/{no}/restore", response_model=TripOut)
async def restore_version(trip_id: uuid.UUID, no: int, cur: Current = Depends(current), db: AsyncSession = DB):
    """Makes a copy of an older version the current one. Nothing is lost."""
    return await trips.restore_version(db, cur.user, trip_id, no)


# ---- Itinerary items (current version) ----


@router.post("/{trip_id}/items", status_code=201, response_model=TripOut)
async def add_item(trip_id: uuid.UUID, body: ItemIn, cur: Current = Depends(current), db: AsyncSession = DB):
    return await trips.add_item(db, cur.user, trip_id, body.model_dump())


@router.patch("/{trip_id}/items/{item_id}", response_model=TripOut)
async def update_item(trip_id: uuid.UUID, item_id: uuid.UUID, body: ItemPatch, cur: Current = Depends(current), db: AsyncSession = DB):
    return await trips.update_item(db, cur.user, trip_id, item_id, body.model_dump(exclude_unset=True))


@router.delete("/{trip_id}/items/{item_id}", response_model=TripOut)
async def delete_item(trip_id: uuid.UUID, item_id: uuid.UUID, cur: Current = Depends(current), db: AsyncSession = DB):
    return await trips.delete_item(db, cur.user, trip_id, item_id)


# ---- Exact prices ----


@router.post("/{trip_id}/prices", response_model=TripOut)
async def save_prices(trip_id: uuid.UUID, body: PricingIn, cur: Current = Depends(current), db: AsyncSession = DB):
    """Saves an exact-price check to the trip."""
    return await trips.save_pricing(db, cur.user, trip_id, body.model_dump())


# ---- Share links ----


@router.post("/{trip_id}/shares", status_code=201, response_model=ShareOut)
async def create_share(trip_id: uuid.UUID, cur: Current = Depends(current), db: AsyncSession = DB):
    """A read-only link to the trip. The token is shown only now; the database keeps its hash."""
    return await trips.create_share(db, cur.user, trip_id)


@router.get("/{trip_id}/shares", response_model=list[ShareOut])
async def list_shares(trip_id: uuid.UUID, cur: Current = Depends(current), db: AsyncSession = DB):
    return await trips.list_shares(db, cur.user, trip_id)


@shared.delete("/shares/{share_id}", status_code=204, tags=["trips"])
async def revoke_share(share_id: uuid.UUID, cur: Current = Depends(current), db: AsyncSession = DB):
    """Turns a share link off."""
    await trips.revoke_share(db, cur.user, share_id)
    return Response(status_code=204)


@shared.get("/shared/{token}", response_model=SharedTripOut)
async def open_shared(token: str, db: AsyncSession = DB):
    """The read-only trip behind a share link. Open to anyone with the link."""
    return await trips.open_share(db, token)
