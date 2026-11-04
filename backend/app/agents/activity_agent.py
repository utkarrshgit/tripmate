from app.agents.base import BaseAgent
from app.agents.context import RunContext
from app.agents.state import AgentState
from app.llm import prompts


class ActivityAgent(BaseAgent):
    """Chooses things to do. With the catalog, the general model ranks its places for the traveller's
    interests, and only listed places count. Costs come from the catalog, never from the model."""

    name = "activity"

    async def run(self, state: AgentState, ctx: RunContext) -> AgentState:
        days = max(state.get("days", 3), 1)
        travelers = max(state.get("travelers", 1), 1)
        interests = state.get("interests", [])
        candidates = [p for p in (ctx.catalog or {}).get("places", []) if p["kind"] == "activity"]

        if candidates:
            want = min(len(candidates), max(2, days * 2))
            chosen = await self._ai_pick(ctx, candidates, interests, days, want) or []
            # Too few picks (or none): top up from the tag ranking, so every day has something to do.
            for place in self._rule_pick(candidates, interests, len(candidates)):
                if len(chosen) >= want:
                    break
                if place not in chosen:
                    chosen.append(place)
            activities = [
                {
                    "name": p["name"],
                    "place_id": p["id"],
                    "estimated_cost": round(p["est_cost"] * travelers, 2),
                    "cost_per_person": p["est_cost"],
                    "duration_hours": p["duration_hours"],
                    "tags": p["tags"],
                }
                for p in chosen
            ]
        else:
            destination = state.get("destination") or ""
            activities = [
                {"name": f"{destination} sightseeing" if destination else "Local sightseeing", "estimated_cost": 500},
                {"name": "Viewpoints and landmarks", "estimated_cost": 300},
                {"name": "Local experiences", "estimated_cost": 700},
            ]
            if "trekking" in interests or "adventure" in interests:
                activities.append({"name": "Adventure or trek", "estimated_cost": 1200})

        state["activities"] = activities
        state["estimated_activity_cost"] = float(sum(a["estimated_cost"] for a in activities))
        return self.mark_completed(state)

    async def _ai_pick(self, ctx: RunContext, candidates: list[dict], interests: list[str], days: int, want: int) -> list[dict] | None:
        listing = "\n".join(f'{p["id"]}: {p["name"]} (tags: {", ".join(p["tags"]) or "none"}; {p["duration_hours"]} h)' for p in candidates)
        prompt = f"Interests: {', '.join(interests) or 'none given'}\nDays: {days}\nChoose about {want}.\nPlaces:\n{listing}"
        reply = await ctx.gateway.extract(self.name, prompts.PlaceChoice, prompts.PICK_ACTIVITIES, prompt)
        if reply is None:
            return None
        by_id = {p["id"]: p for p in candidates}
        picked = [by_id[i] for i in dict.fromkeys(reply.place_ids) if i in by_id]  # unknown IDs are dropped
        return picked[:want] if len(picked) >= min(2, want) else None

    @staticmethod
    def _rule_pick(candidates: list[dict], interests: list[str], want: int) -> list[dict]:
        """Most interest tags in common first, then cheaper first."""
        ranked = sorted(candidates, key=lambda p: (-len(set(p["tags"]) & set(interests)), p["est_cost"]))
        return ranked[:want]
