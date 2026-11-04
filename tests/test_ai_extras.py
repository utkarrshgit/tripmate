"""Change it in words, search by meaning, and the model activity page."""

import os

import pytest
from sqlalchemy import select, update

from app.db.seed import seed_catalog
from app.llm.gateway import Call, Gateway
from app.models import User
from app.services import reviser, search_service
from tests.test_accounts import V1, signed_up
from tests.test_ai_planning import FakeGateway
from tests.test_trips import saved

pytestmark = pytest.mark.asyncio

# A tiny stand-in for embeddings: one dimension per theme, counted from words.
THEMES = {
    "sea": ["beach", "sea", "sand", "goa", "island", "andaman", "coast"],
    "hills": ["mountain", "snow", "trek", "manali", "hill", "himalaya", "ladakh"],
    "heritage": ["fort", "temple", "history", "jaipur", "hampi", "palace", "ruins"],
}


class EmbeddingGateway(FakeGateway):
    async def embed(self, agent, texts, *, timeout=30):
        self.calls.append(Call(agent, "fake-embed", "embed", True, 2))
        return [[sum(t.lower().count(w) for w in words) + 0.01 for words in THEMES.values()] for t in texts]


async def user_and_trip(api, db, query="4 days in Goa for 2 people under 25000, beaches and food", dates=True):
    await seed_catalog(db)
    await signed_up(api)
    trip = await saved(api, query=query, dates=dates)
    user = await db.scalar(select(User))
    return user, trip


# ---- Change it in words ------------------------------------------------------


async def test_change_it_in_words_makes_a_new_version(api, db):
    # A short Jaipur trip leaves catalog places that aren't in the plan yet.
    user, trip = await user_and_trip(api, db, query="2 days in Jaipur for 2 people, history", dates=False)
    target = next(i for i in trip["items"] if i["day_no"] == 2 and i["slot"] == "afternoon")

    names = []  # the place the fake model adds, read from the prompt

    def edits(prompt):
        # The model sees short IDs: pick them out of the prompt, as the real model would.
        line = lambda text: next(l for l in prompt.splitlines() if text in l).split(":")[0]  # noqa: E731
        addable = [l.split(":")[0] for l in prompt.splitlines() if l.startswith("p") and " (" in l]
        names.append(next(l for l in prompt.splitlines() if l.startswith(addable[0] + ":")).split(": ", 1)[1].split(" (")[0])
        return {"edits": [
            {"action": "replace", "item_id": line("day 2 afternoon"), "place_id": "free"},
            {"action": "add", "place_id": addable[0], "day": 1, "slot": "evening"},
            {"action": "remove", "item_id": "i999"},  # unknown: ignored
            {"action": "remove", "item_id": line("day 2 morning"), "day": None},  # kept: only the afternoon is relaxed
            {"action": "move", "item_id": line("day 1 morning"), "day": 3, "slot": "morning"},  # day 3 isn't named: ignored
        ]}

    gateway = FakeGateway(script={"reviser": edits}, decisions={"reviser": 0.95})
    out = await reviser.revise_trip(db, user, trip["id"], "make day 2 more relaxed and add something on day 1", gateway=gateway)

    assert out["version"]["no"] == 2 and out["version"]["source"] == "revise"
    assert out["query"] == "make day 2 more relaxed and add something on day 1"
    assert out["changes"][0].startswith("Day 2 afternoon is now free time")
    assert out["changes"][1] == f"Added {names[0]} to day 1 evening"
    assert out["changes"][2].startswith("Removed") and len(out["changes"]) == 3  # the day 3 move was ignored
    assert out["plan"]["itinerary"][1]["afternoon"].startswith("Free time to explore")
    assert names[0] in out["plan"]["itinerary"][0]["evening"]
    # Costs come from the catalog: the removed item's cost goes, the added place's (× 2 people) comes.
    added = next(i for i in out["items"] if i["title"] == names[0])
    removed = next(i for i in trip["items"] if i["day_no"] == 2 and i["slot"] == "morning")
    assert out["plan"]["total_cost"] == trip["plan"]["total_cost"] - target["est_cost"] - removed["est_cost"] + added["est_cost"]
    assert out["revision"]["changes"] == out["changes"]
    # Version 1 is untouched and can come back.
    v1 = (await api.get(f"{V1}/trips/{trip['id']}/versions/1")).json()
    assert v1["plan"]["itinerary"] == trip["plan"]["itinerary"]


async def test_instructions_that_arent_changes_are_refused(api, db):
    user, trip = await user_and_trip(api, db)
    with pytest.raises(reviser.AppError) as err:
        await reviser.revise_trip(db, user, trip["id"], "what's the weather like", gateway=FakeGateway(decisions={"reviser": 0.05}))
    assert err.value.code == "not_an_edit"


async def test_edits_with_only_unknown_ids_change_nothing(api, db):
    user, trip = await user_and_trip(api, db)
    gateway = FakeGateway(script={"reviser": {"edits": [{"action": "remove", "item_id": "nope"}, {"action": "add", "place_id": "nope", "day": 1, "slot": "morning"}]}})
    with pytest.raises(reviser.AppError) as err:
        await reviser.revise_trip(db, user, trip["id"], "make it more fun", gateway=gateway)
    assert err.value.code == "revise_failed"
    assert len((await api.get(f"{V1}/trips/{trip['id']}")).json()["versions"]) == 1


async def test_change_it_in_words_needs_the_model(api, db):
    _, trip = await user_and_trip(api, db)  # tests run with the models switched off
    res = await api.post(f"{V1}/trips/{trip['id']}/revise", json={"instruction": "make day 2 more relaxed"})
    assert res.status_code == 503 and res.json()["error"]["code"] == "ai_unavailable"


# ---- Search by meaning --------------------------------------------------------


async def test_search_trips_by_meaning(api, db):
    user, _ = await user_and_trip(api, db)
    await saved(api, query="5 days in Manali for 3 people, trekking and mountains")
    await saved(api, query="3 days in Jaipur for 2 people, history", dates=False)
    result = await search_service.search_trips(db, user, "somewhere with sand and sea", gateway=EmbeddingGateway())
    assert result["mode"] == "meaning"
    assert result["results"][0]["plan"]["destination"] == "Goa"
    result = await search_service.search_trips(db, user, "snow treks", gateway=EmbeddingGateway())
    assert result["results"][0]["plan"]["destination"] == "Manali"


async def test_search_falls_back_to_words_without_the_model(api, db):
    await user_and_trip(api, db)
    res = (await api.get(f"{V1}/search/trips", params={"q": "goa beaches"})).json()
    assert res["mode"] == "words" and res["results"][0]["plan"]["destination"] == "Goa"
    assert (await api.get(f"{V1}/search/trips", params={"q": "nothing like this"})).json()["results"] == []


async def test_destinations_by_meaning_and_similar_ones(api, db):
    await seed_catalog(db)
    gateway = EmbeddingGateway()
    found = await search_service.search_destinations(db, "an island with a quiet beach", gateway=gateway)
    assert found["mode"] == "meaning" and found["results"][0]["slug"] in {"andaman", "goa"}
    similar = await search_service.similar_destinations(db, "jaipur", gateway=gateway)
    assert similar["results"][0]["slug"] in {"udaipur", "hampi"}
    # Vectors are saved: the next search doesn't embed the catalog again.
    gateway.calls.clear()
    await search_service.search_destinations(db, "forts", gateway=gateway)
    assert len(gateway.calls) == 1


async def test_destination_search_without_the_model(api, db):
    await seed_catalog(db)
    res = (await api.get(f"{V1}/destinations/search", params={"q": "backwaters"})).json()
    assert res["mode"] == "words" and res["results"][0]["slug"] == "kerala"
    assert (await api.get(f"{V1}/destinations/ooty/similar")).status_code == 404
    assert len((await api.get(f"{V1}/destinations")).json()) == 12


# ---- Model activity page ------------------------------------------------------


async def test_model_activity_for_admins(api, db):
    await signed_up(api)
    await api.post(f"{V1}/plans", json={"query": "4 days in Goa for 2 people"})
    assert (await api.get(f"{V1}/admin/ai-activity")).status_code == 403
    await db.execute(update(User).values(role="admin"))
    await db.commit()
    report = (await api.get(f"{V1}/admin/ai-activity")).json()
    assert report["totals"]["runs"] == 1 and report["recent"][0]["request"] == "4 days in Goa for 2 people"
    assert report["recent"][0]["signed_in"] is True


# ---- Real models (optional) --------------------------------------------------


@pytest.mark.skipif(os.environ.get("RUN_OLLAMA_TESTS") != "1", reason="set RUN_OLLAMA_TESTS=1 to use the real Ollama models")
async def test_real_embeddings_find_the_sea(api, db):
    await seed_catalog(db)
    found = await search_service.search_destinations(db, "turquoise water, coral and diving", gateway=Gateway(enabled=True))
    assert found["mode"] == "meaning" and found["results"][0]["slug"] == "andaman"


@pytest.mark.skipif(os.environ.get("RUN_OLLAMA_TESTS") != "1", reason="set RUN_OLLAMA_TESTS=1 to use the real Ollama models")
async def test_real_model_makes_a_day_more_relaxed(api, db):
    user, trip = await user_and_trip(api, db, query="3 days in Jaipur for 2 people, history and shopping")
    out = await reviser.revise_trip(db, user, trip["id"], "make day 2 more relaxed", gateway=Gateway(enabled=True))
    assert out["version"]["source"] == "revise" and out["changes"]


def test_days_named_in_an_instruction():
    assert reviser.days_named("make day 2 more relaxed") == {2}
    assert reviser.days_named("swap things on days 2 and 3") == {2, 3}
    assert reviser.days_named("add a trek") == set()


async def test_exact_commands_dont_need_the_model(api, db):
    user, trip = await user_and_trip(api, db, query="2 days in Jaipur for 2 people, history", dates=False)
    titles = [i["title"] for i in trip["items"] if not i["title"].startswith(("Breakfast", "Free", "Local"))]
    a, b = titles[0], titles[1]
    # No model at all (switched off in tests): exact commands still work.
    swapped = await reviser.revise_trip(db, user, trip["id"], f"swap {a} for {b}", gateway=Gateway(enabled=False))
    assert [c.split(" to ")[0] for c in swapped["changes"]] == [f"Moved {a}", f"Moved {b}"]
    dropped = await reviser.revise_trip(db, user, trip["id"], f"drop {a}", gateway=Gateway(enabled=False))
    assert dropped["changes"][0].endswith(f"is now free time (was {a})")
    with pytest.raises(reviser.AppError) as err:
        await reviser.revise_trip(db, user, trip["id"], f"add {b} on day 1", gateway=Gateway(enabled=False))
    assert err.value.code == "already_in_plan"
