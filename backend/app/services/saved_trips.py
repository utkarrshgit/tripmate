"""
Saved trips: create, list, read, rename, trash and restore, versions, itinerary items,
exact prices and share links. Every function takes the signed-in user and only ever
touches that user's trips; anyone else's trip looks the same as a missing one (404).

How a trip is stored:
  trips            one row per saved trip
  plan_versions    each plan of it: the planner's full response (`plan`), the request, costs
  itinerary_items  the current days, one row per morning, afternoon or evening; editable
  price_quotes     exact-price checks
When read, a version's itinerary is rebuilt from its items, so edits show up everywhere.
"""

import copy
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core import security
from app.core.errors import AppError
from app.models import Destination, ItineraryItem, PlanVersion, PriceQuote, Trip, TripShare, User

SLOTS = ("morning", "afternoon", "evening")
TRASH_DAYS = 30
CARD_FIELDS = ("destination", "days", "travelers", "budget", "total_cost", "start_date", "end_date", "interests")


def now() -> datetime:
    return datetime.now(timezone.utc)


def _not_found() -> AppError:
    return AppError(404, "not_found", "We couldn't find that trip. It may have been deleted.")


def _money(value) -> Decimal:
    return Decimal(str(round(float(value or 0), 2)))


def _date(value) -> date | None:
    """Plans arrive as JSON, so their dates are ISO strings."""
    if isinstance(value, date) or value is None:
        return value
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return None


# ---- Plans ↔ items ---------------------------------------------------------


def items_from_plan(plan: dict) -> list[ItineraryItem]:
    """One item per filled-in part of each day. An activity's estimated cost goes on its item."""
    costs = {a.get("name"): a.get("estimated_cost", 0) for a in plan.get("activities", []) if a.get("name")}
    # Catalog places the planner chose, so each item can point at the place it came from.
    place_ids = {p.get("name"): p.get("place_id") for p in [*plan.get("activities", []), *plan.get("food_places", [])] if p.get("place_id")}
    items = []
    for day in plan.get("itinerary", []):
        for slot in SLOTS:
            title = (day.get(slot) or "").strip()
            if title:
                items.append(
                    ItineraryItem(
                        day_no=int(day.get("day", 1)),
                        slot=slot,
                        position=0,
                        title=title[:150],
                        est_cost=_money(costs.get(title, 0)),
                        place_id=_uuid(place_ids.get(title)),
                    )
                )
    return items


def _uuid(value):
    try:
        return uuid.UUID(str(value)) if value else None
    except ValueError:
        return None


def plan_with_items(version: PlanVersion) -> dict:
    """The version's plan with its itinerary rebuilt from the current items (several in a slot are joined)."""
    plan = copy.deepcopy(version.plan)
    start = plan.get("start_date")
    start = date.fromisoformat(start) if isinstance(start, str) and start else None
    days = max([plan.get("days", 0)] + [i.day_no for i in version.items])
    itinerary = []
    for day_no in range(1, days + 1):
        day = {"day": day_no, "date": (start + timedelta(days=day_no - 1)).isoformat() if start else None}
        for slot in SLOTS:
            titles = [i.title for i in version.items if i.day_no == day_no and i.slot == slot]
            day[slot] = " · ".join(titles)
        itinerary.append(day)
    plan["itinerary"] = itinerary
    plan["total_cost"] = float(version.total_cost)
    plan["cost_breakdown"] = version.cost_breakdown
    return plan


def _card_plan(version: PlanVersion) -> dict:
    plan = {k: version.plan.get(k) for k in CARD_FIELDS if k in version.plan}
    plan["total_cost"] = float(version.total_cost)
    return plan


async def _destination_id(db: AsyncSession, name: str):
    if not name:
        return None
    return await db.scalar(select(Destination.id).where(func.lower(Destination.name) == name.strip().lower()))


def _new_version(trip: Trip, no: int, query: str, plan: dict, source: str, items: list[ItineraryItem] | None = None) -> PlanVersion:
    stored = {k: v for k, v in plan.items() if k != "itinerary"}
    stored["itinerary_days"] = len(plan.get("itinerary", []))
    return PlanVersion(
        trip=trip,
        version_no=no,
        request_text=query,
        source=source,
        total_cost=_money(plan.get("total_cost")),
        cost_breakdown=plan.get("cost_breakdown") or {},
        issues=plan.get("issues") or [],
        plan=stored,
        items=items if items is not None else items_from_plan(plan),
    )


# ---- Reading ---------------------------------------------------------------


def _trip_query(user: User):
    # populate_existing: always re-read, so a trip read straight after a change reflects it.
    return (
        select(Trip)
        .where(Trip.user_id == user.id)
        .options(selectinload(Trip.versions).selectinload(PlanVersion.items))
        .execution_options(populate_existing=True)
    )


async def _purge_trash(db: AsyncSession, user: User) -> None:
    old = (await db.scalars(select(Trip).where(Trip.user_id == user.id, Trip.deleted_at < now() - timedelta(days=TRASH_DAYS)))).all()
    for trip in old:
        await db.delete(trip)
    if old:
        await db.commit()


async def _load(db: AsyncSession, user: User, trip_id, *, deleted: bool = False) -> Trip:
    trip = await db.scalar(_trip_query(user).where(Trip.id == trip_id))
    if trip is None or (trip.deleted_at is not None) != deleted:
        raise _not_found()
    return trip


def _current(trip: Trip) -> PlanVersion:
    return next((v for v in trip.versions if v.id == trip.current_version_id), None) or max(trip.versions, key=lambda v: v.version_no)


async def _latest_pricing(db: AsyncSession, trip: Trip) -> dict | None:
    ids = [v.id for v in trip.versions]
    quote = await db.scalar(select(PriceQuote).where(PriceQuote.version_id.in_(ids)).order_by(PriceQuote.fetched_at.desc()).limit(1)) if ids else None
    return quote.details if quote else None


def _version_summary(trip: Trip, v: PlanVersion) -> dict:
    return {"no": v.version_no, "source": v.source, "query": v.request_text, "total_cost": float(v.total_cost), "created_at": v.created_at, "current": v.id == trip.current_version_id}


async def summary(db: AsyncSession, trip: Trip) -> dict:
    current = _current(trip)
    has_pricing = await db.scalar(select(func.count()).select_from(PriceQuote).where(PriceQuote.version_id.in_([v.id for v in trip.versions])))
    return {
        "id": trip.id,
        "title": trip.title,
        "status": trip.status,
        "query": current.request_text,
        "plan": _card_plan(current),
        "has_pricing": bool(has_pricing),
        "saved_at": trip.created_at,
        "updated_at": trip.updated_at,
        "deleted_at": trip.deleted_at,
    }


async def detail(db: AsyncSession, trip: Trip) -> dict:
    current = _current(trip)
    return {
        **(await summary(db, trip)),
        "plan": plan_with_items(current),
        "version": _version_summary(trip, current),
        "items": [
            {"id": i.id, "day_no": i.day_no, "slot": i.slot, "position": i.position, "title": i.title, "note": i.note, "est_cost": float(i.est_cost)}
            for i in sorted(current.items, key=lambda i: (i.day_no, SLOTS.index(i.slot), i.position))
        ],
        "pricing": await _latest_pricing(db, trip),
        "versions": [_version_summary(trip, v) for v in sorted(trip.versions, key=lambda v: v.version_no, reverse=True)],
    }


async def list_trips(db: AsyncSession, user: User, *, status: str | None, q: str | None, trash: bool, page: int, per_page: int) -> dict:
    await _purge_trash(db, user)
    cond = [Trip.user_id == user.id, Trip.deleted_at.is_not(None) if trash else Trip.deleted_at.is_(None)]
    if status:
        cond.append(Trip.status == status)
    if q:
        like = f"%{q.strip()}%"
        matching_versions = select(PlanVersion.trip_id).where(PlanVersion.request_text.ilike(like))
        cond.append(or_(Trip.title.ilike(like), Trip.id.in_(matching_versions)))
    total = await db.scalar(select(func.count()).select_from(Trip).where(*cond))
    order = Trip.deleted_at.desc() if trash else Trip.updated_at.desc()
    trips = (await db.scalars(_trip_query(user).where(*cond).order_by(order).offset((page - 1) * per_page).limit(per_page))).all()
    return {"trips": [await summary(db, t) for t in trips], "page": page, "per_page": per_page, "total": total}


async def get_trip(db: AsyncSession, user: User, trip_id) -> dict:
    return await detail(db, await _load(db, user, trip_id))


# ---- Creating and changing -------------------------------------------------


def _title(plan: dict, title: str | None) -> str:
    if title and title.strip():
        return title.strip()[:150]
    return f"{plan['destination']} trip" if plan.get("destination") else "Your trip"


async def create_trip(db: AsyncSession, user: User, query: str, plan: dict, pricing: dict | None = None, title: str | None = None) -> dict:
    trip = Trip(
        user_id=user.id,
        destination_id=await _destination_id(db, plan.get("destination", "")),
        title=_title(plan, title),
        start_date=_date(plan.get("start_date")),
        end_date=_date(plan.get("end_date")),
        travelers=plan.get("travelers") or 1,
        budget=_money(plan.get("budget")),
    )
    db.add(trip)
    version = _new_version(trip, 1, query, plan, "plan")
    db.add(version)
    await db.flush()
    trip.current_version_id = version.id
    if pricing:
        _add_quote(db, version, pricing)
    await db.commit()
    return await get_trip(db, user, trip.id)


async def import_trips(db: AsyncSession, user: User, trips: list[dict]) -> int:
    for t in trips:
        await create_trip(db, user, t["query"], t["plan"], t.get("pricing"))
    return len(trips)


async def update_trip(db: AsyncSession, user: User, trip_id, *, title: str | None, status: str | None) -> dict:
    trip = await _load(db, user, trip_id)
    if title is not None:
        if not title.strip():
            raise AppError(422, "title_missing", "Enter a name for the trip.", "title")
        trip.title = title.strip()
    if status:
        trip.status = status
    trip.updated_at = now()
    await db.commit()
    return await get_trip(db, user, trip_id)


async def trash_trip(db: AsyncSession, user: User, trip_id) -> None:
    trip = await _load(db, user, trip_id)
    trip.deleted_at = now()
    await db.commit()


async def restore_trip(db: AsyncSession, user: User, trip_id) -> dict:
    trip = await _load(db, user, trip_id, deleted=True)
    trip.deleted_at = None
    trip.updated_at = now()
    await db.commit()
    return await get_trip(db, user, trip_id)


async def delete_forever(db: AsyncSession, user: User, trip_id) -> None:
    trip = await _load(db, user, trip_id, deleted=True)
    await db.delete(trip)
    await db.commit()


# ---- Versions --------------------------------------------------------------


async def add_version(db: AsyncSession, user: User, trip_id, query: str, plan: dict, *, source: str = "plan") -> dict:
    """A new plan for the trip (planning again). It becomes the current version."""
    trip = await _load(db, user, trip_id)
    version = _new_version(trip, max(v.version_no for v in trip.versions) + 1, query, plan, source)
    db.add(version)
    await db.flush()
    trip.current_version_id = version.id
    trip.start_date, trip.end_date = _date(plan.get("start_date")), _date(plan.get("end_date"))
    trip.travelers, trip.budget = plan.get("travelers") or trip.travelers, _money(plan.get("budget"))
    trip.updated_at = now()
    await db.commit()
    return await get_trip(db, user, trip_id)


async def get_version(db: AsyncSession, user: User, trip_id, no: int) -> dict:
    trip = await _load(db, user, trip_id)
    version = next((v for v in trip.versions if v.version_no == no), None)
    if version is None:
        raise AppError(404, "not_found", "That version of the trip doesn't exist.")
    return {**_version_summary(trip, version), "plan": plan_with_items(version)}


async def restore_version(db: AsyncSession, user: User, trip_id, no: int) -> dict:
    """Copies an older version, with its items, into a new current version."""
    trip = await _load(db, user, trip_id)
    old = next((v for v in trip.versions if v.version_no == no), None)
    if old is None:
        raise AppError(404, "not_found", "That version of the trip doesn't exist.")
    items = [ItineraryItem(day_no=i.day_no, slot=i.slot, position=i.position, title=i.title, note=i.note, place_id=i.place_id, est_cost=i.est_cost) for i in old.items]
    version = PlanVersion(
        trip=trip,
        version_no=max(v.version_no for v in trip.versions) + 1,
        request_text=old.request_text,
        source="restore",
        total_cost=old.total_cost,
        cost_breakdown=dict(old.cost_breakdown),
        issues=list(old.issues),
        plan=copy.deepcopy(old.plan),
        items=items,
    )
    db.add(version)
    await db.flush()
    trip.current_version_id = version.id
    trip.updated_at = now()
    await db.commit()
    return await get_trip(db, user, trip_id)


# ---- Itinerary items (on the current version) ------------------------------


def _adjust_cost(version: PlanVersion, delta: Decimal) -> None:
    """Item costs count as activities: a change moves the activities total and the trip total by the difference."""
    if not delta:
        return
    breakdown = dict(version.cost_breakdown or {})
    breakdown["activities"] = round(float(breakdown.get("activities", 0)) + float(delta), 2)
    version.cost_breakdown = breakdown
    version.total_cost = max(Decimal("0"), version.total_cost + delta)


async def add_item(db: AsyncSession, user: User, trip_id, data: dict) -> dict:
    trip = await _load(db, user, trip_id)
    version = _current(trip)
    same_slot = [i.position for i in version.items if i.day_no == data["day_no"] and i.slot == data["slot"]]
    item = ItineraryItem(version=version, position=max(same_slot, default=-1) + 1, **{**data, "est_cost": _money(data.get("est_cost"))})
    db.add(item)
    _adjust_cost(version, item.est_cost)
    trip.updated_at = now()
    await db.commit()
    return await get_trip(db, user, trip_id)


async def _item(trip: Trip, item_id) -> tuple[PlanVersion, ItineraryItem]:
    version = _current(trip)
    item = next((i for i in version.items if i.id == item_id), None)
    if item is None:
        raise AppError(404, "not_found", "That part of the plan doesn't exist any more.")
    return version, item


async def update_item(db: AsyncSession, user: User, trip_id, item_id, changes: dict) -> dict:
    trip = await _load(db, user, trip_id)
    version, item = await _item(trip, item_id)
    if "est_cost" in changes:
        new_cost = _money(changes.pop("est_cost"))
        _adjust_cost(version, new_cost - item.est_cost)
        item.est_cost = new_cost
    for field, value in changes.items():
        setattr(item, field, value)
    trip.updated_at = now()
    await db.commit()
    return await get_trip(db, user, trip_id)


async def delete_item(db: AsyncSession, user: User, trip_id, item_id) -> dict:
    trip = await _load(db, user, trip_id)
    version, item = await _item(trip, item_id)
    _adjust_cost(version, -item.est_cost)
    await db.delete(item)
    trip.updated_at = now()
    await db.commit()
    return await get_trip(db, user, trip_id)


# ---- Exact prices ----------------------------------------------------------


def _add_quote(db: AsyncSession, version: PlanVersion, pricing: dict) -> None:
    checked = pricing.get("checkedAt") or pricing.get("checked_at")
    try:
        fetched = datetime.fromisoformat(checked.replace("Z", "+00:00")) if checked else now()
    except (AttributeError, ValueError):
        fetched = now()
    provider = (pricing.get("response") or {}).get("provider") or ("sample" if (pricing.get("response") or {}).get("is_sample") else "unknown")
    db.add(PriceQuote(version_id=version.id, provider=str(provider)[:40], category="trip", total=_money(pricing.get("total")), details=pricing, fetched_at=fetched))


async def save_pricing(db: AsyncSession, user: User, trip_id, pricing: dict) -> dict:
    trip = await _load(db, user, trip_id)
    _add_quote(db, _current(trip), pricing)
    trip.updated_at = now()
    await db.commit()
    return await get_trip(db, user, trip_id)


# ---- Share links -----------------------------------------------------------


async def create_share(db: AsyncSession, user: User, trip_id) -> dict:
    trip = await _load(db, user, trip_id)
    token = security.new_token()
    share = TripShare(trip_id=trip.id, token_hash=security.hash_token(token))
    db.add(share)
    await db.commit()
    return {"id": share.id, "created_at": share.created_at, "view_count": 0, "token": token}


async def list_shares(db: AsyncSession, user: User, trip_id) -> list[dict]:
    trip = await _load(db, user, trip_id)
    shares = (await db.scalars(select(TripShare).where(TripShare.trip_id == trip.id, TripShare.revoked_at.is_(None)).order_by(TripShare.created_at.desc()))).all()
    return [{"id": s.id, "created_at": s.created_at, "view_count": s.view_count} for s in shares]


async def revoke_share(db: AsyncSession, user: User, share_id: uuid.UUID) -> None:
    share = await db.scalar(
        select(TripShare).join(Trip, Trip.id == TripShare.trip_id).where(TripShare.id == share_id, Trip.user_id == user.id, TripShare.revoked_at.is_(None))
    )
    if share is None:
        raise AppError(404, "not_found", "That link has already been turned off.")
    share.revoked_at = now()
    await db.commit()


async def open_share(db: AsyncSession, token: str) -> dict:
    """The read-only view behind a share link. Counts the view."""
    share = await db.scalar(select(TripShare).where(TripShare.token_hash == security.hash_token(token), TripShare.revoked_at.is_(None)))
    trip = (
        await db.scalar(select(Trip).where(Trip.id == share.trip_id, Trip.deleted_at.is_(None)).options(selectinload(Trip.versions).selectinload(PlanVersion.items)))
        if share
        else None
    )
    if trip is None:
        raise AppError(404, "not_found", "This link has been turned off, or the trip was deleted.")
    owner = await db.get(User, trip.user_id)
    share.view_count += 1
    await db.commit()
    current = _current(trip)
    return {
        "title": trip.title,
        "query": current.request_text,
        "plan": plan_with_items(current),
        "shared_by": owner.name.split()[0] if owner and owner.name else "A TripMate traveller",
        "saved_at": trip.created_at,
    }
