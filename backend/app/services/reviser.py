"""
"Change it in words": the general model turns an instruction like "make day 2 more relaxed"
into edits on the trip's items (remove, replace, add, move), using item and place IDs only.
Python checks each edit, applies them to a copy, and saves the result as a new version, so
the earlier plan is one Restore away. Costs come from the catalog, never from the model.
"""

import copy
import re
import time
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.llm import prompts
from app.llm.gateway import Gateway
from app.models import Destination, ItineraryItem, PlanVersion, User
from app.services import saved_trips
from app.services.saved_trips import SLOTS, _adjust_cost, _current, _load, _money, now

NOT_AN_EDIT = 0.2


def _where(day: int, slot: str) -> str:
    return f"day {day} {slot}"


async def _catalog_places(db: AsyncSession, destination_id) -> dict[str, dict]:
    if destination_id is None:
        return {}
    dest = await db.scalar(select(Destination).where(Destination.id == destination_id).options(selectinload(Destination.places)))
    return {str(p.id): {"id": p.id, "name": p.name, "kind": p.kind, "est_cost": float(p.est_cost), "hours": float(p.duration_hours), "tags": list(p.tags)} for p in (dest.places if dest else [])}


async def revise_trip(db: AsyncSession, user: User, trip_id, instruction: str, *, gateway: Gateway | None = None) -> dict:
    instruction = instruction.strip()
    if not instruction:
        raise AppError(422, "instruction_missing", "Say what to change, like “make day 2 more relaxed”.", "instruction")
    gateway = gateway or Gateway()
    started = time.perf_counter()
    trip = await _load(db, user, trip_id)
    current = _current(trip)
    places = await _catalog_places(db, trip.destination_id)
    destination = current.plan.get("destination") or "your destination"

    items = sorted(current.items, key=lambda i: (i.day_no, SLOTS.index(i.slot), i.position))
    command = command_edits(instruction, items, places)
    if command is not None:
        version, changes = _apply(trip, current, items, places, command, destination)
        return await _save(db, user, trip, version, changes, instruction)

    answers = await gateway.decide("reviser", instruction, prompts.IS_PLAN_CHANGE)
    if answers and answers.get("q1", {}).get("noul", 1) < NOT_AN_EDIT:
        raise AppError(422, "not_an_edit", "That doesn't look like a change to this trip. Try something like “make day 2 more relaxed” or “swap the museum for a trek”.", "instruction")

    # Short IDs (i1, p1): a small model copies them far more reliably than UUIDs.
    item_ids = {f"i{n}": str(i.id) for n, i in enumerate(items, 1)}
    in_plan = {str(i.place_id) for i in items if i.place_id} | {i.title for i in items}
    addable = [(pid, p) for pid, p in places.items() if pid not in in_plan and p["name"] not in in_plan]
    place_ids = {f"p{n}": pid for n, (pid, _) in enumerate(addable, 1)}
    item_lines = "\n".join(f"{short}: day {i.day_no} {i.slot}: {i.title}" for short, i in zip(item_ids, items))
    place_lines = "\n".join(f'{short}: {p["name"]} ({p["kind"]}, {p["hours"]:g} h, tags: {", ".join(p["tags"]) or "none"})' for short, (_, p) in zip(place_ids, addable))
    prompt = f"Days: {current.plan.get('days')}\nInstruction: {instruction}\n\nCurrent items:\n{item_lines}\n\nPlaces that can be added:\n{place_lines or '(none)'}"
    reply = await gateway.extract("reviser", prompts.Revision, prompts.REVISE_PLAN, prompt, timeout=60)
    await _record(user, instruction, gateway, started)
    if reply is None:
        if not gateway.reachable or not gateway.enabled:
            raise AppError(503, "ai_unavailable", "Changing a plan in words needs the local AI model, and it isn't running. You can still edit the days by hand.")
        raise AppError(422, "revise_failed", "We couldn't work out that change. Try saying it another way, like “swap the museum for a trek”.", "instruction")

    edits = [
        e.model_copy(update={"item_id": item_ids.get(e.item_id, ""), "place_id": "free" if e.place_id == "free" else place_ids.get(e.place_id, "")})
        for e in reply.edits
    ]
    version, changes = _apply(trip, current, items, places, edits, destination, days_named(instruction))
    return await _save(db, user, trip, version, changes, instruction)


async def _save(db: AsyncSession, user: User, trip, version: PlanVersion, changes: list[str], instruction: str) -> dict:
    if not changes:
        raise AppError(422, "revise_failed", "We couldn't find anything to change for that. Try naming the day or the place, like “drop the fort on day 2”.", "instruction")
    version.request_text = instruction
    db.add(version)
    await db.flush()
    trip.current_version_id = version.id
    trip.updated_at = now()
    await db.commit()
    return {**(await saved_trips.get_trip(db, user, trip.id)), "changes": changes}


_STOP = {"the", "and", "for", "with", "day", "days", "trip", "visit", "place", "a", "an", "to", "on", "in", "of", "at"}


def _words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]+", text.lower()) if len(w) > 2 and w not in _STOP}


def _stem(w: str) -> str:
    return w[:-1] if w.endswith("s") and len(w) > 4 else w


def _match(text: str, names: list[str]) -> int | None:
    """The one name sharing the most words with `text` ("the bazaars" → "Johari and Bapu Bazaars"), or None."""
    words = _words(text)
    want = {_stem(w) for w in words}
    # An exact word counts double, so "bazaars" prefers "Bapu Bazaars" over "Johari Bazaar".
    scores = [len(want & {_stem(w) for w in _words(n)}) + len(words & _words(n)) for n in names]
    best = max(scores, default=0)
    return scores.index(best) if best and scores.count(best) == 1 else None


def command_edits(instruction: str, items: list[ItineraryItem], places: dict) -> list[prompts.Edit] | None:
    """Exact commands done in Python: "swap X for Y", "drop X", "add X on day 2 (evening)".
    Returns None when the instruction isn't one of these, or names don't match: then the model decides."""
    text = instruction.strip().rstrip(".!").lower()
    titles = [i.title for i in items]
    place_list = list(places.items())

    if m := re.fullmatch(r"(?:swap|replace|switch|change)\s+(?:the\s+)?(.+?)\s+(?:for|with|to)\s+(?:the\s+)?(.+)", text):
        x = _match(m.group(1), titles)
        if x is None:
            return None
        y_item = _match(m.group(2), titles)
        if y_item is not None and y_item != x:  # both already in the plan: trade places
            a, b = items[x], items[y_item]
            return [
                prompts.Edit(action="move", item_id=str(a.id), day=b.day_no, slot=b.slot),
                prompts.Edit(action="move", item_id=str(b.id), day=a.day_no, slot=a.slot),
            ]
        y = _match(m.group(2), [p["name"] for _, p in place_list])
        return [prompts.Edit(action="replace", item_id=str(items[x].id), place_id=place_list[y][0])] if y is not None else None

    if m := re.fullmatch(r"(?:drop|remove|skip|cancel|delete)\s+(?:the\s+)?(.+?)(?:\s+(?:on|from)\s+day\s+\d+)?", text):
        x = _match(m.group(1), titles)
        return [prompts.Edit(action="replace", item_id=str(items[x].id), place_id="free")] if x is not None else None

    if m := re.fullmatch(r"(?:add|include)\s+(?:the\s+)?(.+?)\s+(?:on|to)\s+day\s+(\d+)(?:\s+(?:in\s+the\s+)?(morning|afternoon|evening))?", text):
        already = _match(m.group(1), titles)
        if already is not None:
            i = items[already]
            raise AppError(422, "already_in_plan", f"{i.title} is already in the plan, on day {i.day_no} in the {i.slot}. Try moving it instead.", "instruction")
        y = _match(m.group(1), [p["name"] for _, p in place_list])
        if y is None:
            return None
        pid, place = place_list[y]
        slot = m.group(3) or ("evening" if place["kind"] == "food" else "afternoon")
        return [prompts.Edit(action="add", place_id=pid, day=int(m.group(2)), slot=slot)]
    return None


def days_named(instruction: str) -> set[int]:
    """Days the instruction mentions ("day 2", "days 2 and 3"): edits must stay on them."""
    found = set()
    for m in re.finditer(r"\bdays?\s+(\d+(?:\s*(?:,|and|&)\s*\d+)*)", instruction.lower()):
        found |= {int(n) for n in re.findall(r"\d+", m.group(1))}
    return found


def _apply(trip, current: PlanVersion, items: list[ItineraryItem], places: dict, edits: list[prompts.Edit], destination: str, only_days: set[int] = frozenset()):
    """Copies the current version and applies the valid edits. Returns (new version, plain-language changes).
    An edit is skipped when it names an unknown item or place, touches a day the instruction didn't name,
    would put a place in the plan twice, or changes nothing."""
    days = int(current.plan.get("days") or max((i.day_no for i in items), default=1))
    travelers = int(current.plan.get("travelers") or 1)
    copies = {str(i.id): ItineraryItem(day_no=i.day_no, slot=i.slot, position=i.position, title=i.title, note=i.note, place_id=i.place_id, est_cost=i.est_cost) for i in items}
    version = PlanVersion(
        trip_id=trip.id,
        version_no=max(v.version_no for v in trip.versions) + 1,
        request_text="",
        source="revise",
        total_cost=current.total_cost,
        cost_breakdown=dict(current.cost_breakdown),
        issues=list(current.issues),
        plan=copy.deepcopy(current.plan),
        items=[],
    )
    free_title = lambda slot: {"morning": f"Breakfast and a slow start in {destination}", "afternoon": f"Free time to explore {destination}", "evening": "Local food and time to explore"}[slot]  # noqa: E731
    cost_of = lambda p: _money(p["est_cost"] * travelers if p["kind"] == "activity" else 0)  # noqa: E731 - meals are in the food budget
    changes, removed = [], set()
    on_named_day = lambda day: not only_days or day in only_days  # noqa: E731
    in_plan = lambda p: any(i.place_id == p["id"] or i.title == p["name"] for k, i in copies.items() if k not in removed)  # noqa: E731

    for edit in edits:
        item = copies.get(edit.item_id)
        place = places.get(edit.place_id)
        if item and not on_named_day(item.day_no):
            continue
        if edit.action in ("add", "move") and edit.day and not on_named_day(edit.day):
            continue
        if place and in_plan(place):
            continue  # no place twice; this also drops "replace X with X"
        if edit.action == "remove" and item and edit.item_id not in removed:
            removed.add(edit.item_id)
            _adjust_cost(version, -item.est_cost)
            changes.append(f"Removed {item.title} from {_where(item.day_no, item.slot)}")
        elif edit.action == "replace" and item and edit.item_id not in removed and (place or edit.place_id == "free"):
            old = item.title
            _adjust_cost(version, -item.est_cost)
            if place:
                item.title, item.place_id, item.est_cost = place["name"], place["id"], cost_of(place)
                _adjust_cost(version, item.est_cost)
                changes.append(f"{_where(item.day_no, item.slot).capitalize()}: {old} → {place['name']}")
            else:
                item.title, item.place_id, item.est_cost = free_title(item.slot), None, Decimal("0")
                changes.append(f"{_where(item.day_no, item.slot).capitalize()} is now free time (was {old})")
        elif edit.action == "add" and place and edit.day and edit.slot and 1 <= edit.day <= days:
            new = ItineraryItem(day_no=edit.day, slot=edit.slot, position=99, title=place["name"], place_id=place["id"], est_cost=cost_of(place))
            copies[f"new-{len(copies)}"] = new
            _adjust_cost(version, new.est_cost)
            changes.append(f"Added {place['name']} to {_where(edit.day, edit.slot)}")
        elif edit.action == "move" and item and edit.item_id not in removed and edit.day and edit.slot and 1 <= edit.day <= days:
            if (item.day_no, item.slot) != (edit.day, edit.slot):
                item.day_no, item.slot, item.position = edit.day, edit.slot, 99
                changes.append(f"Moved {item.title} to {_where(edit.day, edit.slot)}")
        # Anything else (unknown IDs, missing fields) is ignored.

    version.items = [i for key, i in copies.items() if key not in removed]
    version.plan["revision"] = {"changes": changes}
    return version, changes


async def _record(user: User, instruction: str, gateway: Gateway, started: float) -> None:
    from app.services.trip_service import _record as record_run

    await record_run(f"Revise: {instruction}", user.id, gateway, int((time.perf_counter() - started) * 1000), "done")
