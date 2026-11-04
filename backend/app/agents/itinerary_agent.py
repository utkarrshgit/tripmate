from datetime import date, timedelta

from app.agents.base import BaseAgent
from app.agents.context import RunContext
from app.agents.state import AgentState
from app.llm import prompts

SLOTS = ("morning", "afternoon", "evening")


class ItineraryAgent(BaseAgent):
    """Lays out each day. The general model decides the order (which chosen place goes in which part
    of which day); Python checks it and writes the text, so only real catalog places appear."""

    name = "itinerary"

    async def run(self, state: AgentState, ctx: RunContext) -> AgentState:
        days = max(state.get("days", 3), 1)
        destination = state.get("destination") or ""
        start = date.fromisoformat(state["start_date"]) if state.get("start_date") else None
        activities = state.get("activities", [])
        food = state.get("food_places", [])
        places = {a["place_id"]: {**a, "kind": "activity"} for a in activities if a.get("place_id")}
        places |= {f["place_id"]: {**f, "kind": "food", "duration_hours": 1} for f in food if f.get("place_id")}

        layout = (await self._ai_layout(ctx, days, places) if places else None) or self._rule_layout(days, activities, food)
        self._respect_time_of_day(layout)
        free = {
            "morning": f"Breakfast and a slow start in {destination}" if destination else "Breakfast and a slow start",
            "afternoon": f"Free time to explore {destination}" if destination else "Free time to explore",
            "evening": "Local food and time to explore",
        }
        itinerary = []
        for day in range(1, days + 1):
            slots = layout.get(day, {})
            itinerary.append(
                {
                    "day": day,
                    "date": (start + timedelta(days=day - 1)).isoformat() if start else None,
                    **{slot: slots.get(slot) or free[slot] for slot in SLOTS},
                }
            )
        state["itinerary"] = itinerary
        return self.mark_completed(state)

    async def _ai_layout(self, ctx: RunContext, days: int, places: dict) -> dict | None:
        listing = "\n".join(f'{pid}: {p["name"]} ({p["kind"]}, {p.get("duration_hours", 1)} h)' for pid, p in places.items())
        reply = await ctx.gateway.extract(self.name, prompts.Itinerary, prompts.ARRANGE_DAYS, f"Days: {days}\nPlaces:\n{listing}", timeout=60)
        if reply is None:
            return None
        layout, used = {}, set()
        for d in reply.days:
            if not 1 <= d.day <= days or d.day in layout:
                continue
            slots = {}
            for slot in SLOTS:
                pid = getattr(d, slot).strip()
                if pid in places and pid not in used:  # only listed places, each once
                    slots[slot] = places[pid]["name"]
                    used.add(pid)
            layout[d.day] = slots
        # A layout that leaves most chosen activities out isn't worth keeping.
        activity_ids = [pid for pid, p in places.items() if p["kind"] == "activity"]
        if len(set(activity_ids) & used) < min(len(activity_ids), days) // 2:
            return None
        self._fill_empty_days(layout, days, [places[pid]["name"] for pid in activity_ids if pid not in used])
        return layout

    @staticmethod
    def _fill_empty_days(layout: dict, days: int, unused: list[str]) -> None:
        """Puts activities the model left out into the days with the least planned, afternoon first."""
        for name in unused:
            open_slots = [
                (sum(1 for s in ("morning", "afternoon") if layout.get(d, {}).get(s)), d, slot)
                for d in range(1, days + 1)
                for slot in ("afternoon", "morning")
                if not layout.get(d, {}).get(slot)
            ]
            if not open_slots:
                return
            _, day, slot = min(open_slots)
            layout.setdefault(day, {})[slot] = name

    @staticmethod
    def _respect_time_of_day(layout: dict) -> None:
        """A place named for sunset belongs in the evening, and one for sunrise in the morning: swap it there."""
        for slots in layout.values():
            for word, target in (("sunset", "evening"), ("sunrise", "morning")):
                for slot in SLOTS:
                    name = slots.get(slot) or ""
                    if slot != target and word in name.lower():
                        slots[slot], slots[target] = slots.get(target), name
                        break

    @staticmethod
    def _rule_layout(days: int, activities: list[dict], food: list[dict]) -> dict:
        """Afternoons first, mornings once there are more activities than days; food places in the evenings."""
        queue = [a["name"] for a in activities]
        layout = {}
        for day in range(1, days + 1):
            slots = {}
            if queue:
                slots["afternoon"] = queue.pop(0)
            if queue and len(queue) >= days - day + 1:
                slots["morning"] = queue.pop(0)
            if food:
                slots["evening"] = food[(day - 1) % len(food)]["name"]
            layout[day] = slots
        return layout
