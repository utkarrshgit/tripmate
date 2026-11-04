"""Saved trips end to end, using real plans from the planner endpoint."""

from datetime import date, timedelta

import pytest
from sqlalchemy import func, select, update

from app.db.seed import seed_catalog
from app.models import ItineraryItem, PlanVersion, Trip
from tests.test_accounts import V1, second_browser, signed_up

pytestmark = pytest.mark.asyncio
START = date.today() + timedelta(days=30)


async def plan(api, query="4 days in Goa for 2 people under 25000, beaches and food", dates=True):
    body = {"query": query}
    if dates:
        body |= {"start_date": START.isoformat(), "end_date": (START + timedelta(days=3)).isoformat()}
    res = await api.post("/api/trips/plan", json=body)
    assert res.status_code == 200, res.text
    return query, res.json()


async def saved(api, **kw):
    query, p = await plan(api, **kw)
    res = await api.post(f"{V1}/trips", json={"query": query, "plan": p})
    assert res.status_code == 201, res.text
    return res.json()


async def test_saving_needs_an_account(api):
    query, p = await plan(api)
    assert (await api.post(f"{V1}/trips", json={"query": query, "plan": p})).status_code == 401


async def test_save_and_read_a_trip_like_the_website_shows_it(api, db):
    await seed_catalog(db)
    await signed_up(api)
    query, p = await plan(api)
    trip = (await api.post(f"{V1}/trips", json={"query": query, "plan": p})).json()

    assert trip["title"] == "Goa trip" and trip["query"] == query and trip["version"]["no"] == 1
    # The plan reads back the same, with the itinerary rebuilt from editable items.
    assert trip["plan"]["destination"] == "Goa" and trip["plan"]["total_cost"] == p["total_cost"]
    assert trip["plan"]["itinerary"] == p["itinerary"]
    assert len(trip["items"]) == 3 * p["days"]
    assert await db.scalar(select(Trip.destination_id)) is not None  # linked to the catalog

    listed = (await api.get(f"{V1}/trips")).json()
    assert listed["total"] == 1 and listed["trips"][0]["plan"]["days"] == p["days"]
    assert "itinerary" not in listed["trips"][0]["plan"]  # lists carry only what a card shows


async def test_other_people_cant_see_or_change_your_trips(api):
    await signed_up(api)
    trip = await saved(api)
    async with second_browser(api) as other:
        await signed_up(other, email="ravi@example.test")
        for method, path in [("GET", ""), ("PATCH", ""), ("DELETE", ""), ("POST", "/shares"), ("POST", "/prices")]:
            body = {"title": "Mine"} if method == "PATCH" else {"total": 1} if path == "/prices" else None
            res = await other.request(method, f"{V1}/trips/{trip['id']}{path}", json=body)
            assert res.status_code == 404, (method, path)
        assert (await other.get(f"{V1}/trips")).json()["total"] == 0


async def test_rename_archive_search_and_filter(api):
    await signed_up(api)
    goa = await saved(api)
    await saved(api, query="3 days in Jaipur for 2 people under 18000, history", dates=False)
    renamed = (await api.patch(f"{V1}/trips/{goa['id']}", json={"title": "Anniversary in Goa"})).json()
    assert renamed["title"] == "Anniversary in Goa"
    assert (await api.patch(f"{V1}/trips/{goa['id']}", json={"title": "  "})).json()["error"]["code"] == "title_missing"
    await api.patch(f"{V1}/trips/{goa['id']}", json={"status": "archived"})

    assert (await api.get(f"{V1}/trips", params={"q": "jaipur"})).json()["total"] == 1
    assert (await api.get(f"{V1}/trips", params={"q": "anniversary"})).json()["total"] == 1
    assert (await api.get(f"{V1}/trips", params={"status": "archived"})).json()["trips"][0]["id"] == goa["id"]


async def test_trash_restore_and_delete_forever(api, db):
    await signed_up(api)
    trip = await saved(api)
    assert (await api.delete(f"{V1}/trips/{trip['id']}")).status_code == 204
    assert (await api.get(f"{V1}/trips")).json()["total"] == 0
    assert (await api.get(f"{V1}/trips/{trip['id']}")).status_code == 404
    trash = (await api.get(f"{V1}/trips/trash")).json()
    assert trash["total"] == 1 and trash["trips"][0]["deleted_at"]

    assert (await api.post(f"{V1}/trips/{trip['id']}/restore")).status_code == 200
    assert (await api.get(f"{V1}/trips")).json()["total"] == 1

    await api.delete(f"{V1}/trips/{trip['id']}")
    assert (await api.delete(f"{V1}/trips/{trip['id']}", params={"forever": "true"})).status_code == 204
    assert await db.scalar(select(func.count()).select_from(Trip)) == 0
    assert await db.scalar(select(func.count()).select_from(PlanVersion)) == 0


async def test_trash_empties_itself_after_30_days(api, db):
    await signed_up(api)
    trip = await saved(api)
    await api.delete(f"{V1}/trips/{trip['id']}")
    await db.execute(update(Trip).values(deleted_at=func.now() - timedelta(days=31)))
    await db.commit()
    assert (await api.get(f"{V1}/trips/trash")).json()["total"] == 0
    assert await db.scalar(select(func.count()).select_from(Trip)) == 0


async def test_plan_again_adds_versions_and_old_ones_can_come_back(api):
    await signed_up(api)
    trip = await saved(api)
    query, p = await plan(api, query="5 days in Goa for 2 people under 40000, nightlife")
    v2 = (await api.post(f"{V1}/trips/{trip['id']}/versions", json={"query": query, "plan": p})).json()
    assert v2["version"]["no"] == 2 and v2["query"] == query
    assert [v["no"] for v in v2["versions"]] == [2, 1]

    v1 = (await api.get(f"{V1}/trips/{trip['id']}/versions/1")).json()
    assert v1["plan"]["days"] == trip["plan"]["days"] and not v1["current"]

    back = (await api.post(f"{V1}/trips/{trip['id']}/versions/1/restore")).json()
    assert back["version"]["no"] == 3 and back["version"]["source"] == "restore"
    assert back["plan"]["itinerary"] == trip["plan"]["itinerary"]
    assert (await api.get(f"{V1}/trips/{trip['id']}/versions/9")).status_code == 404


async def test_edit_items_and_the_total_follows(api, db):
    await signed_up(api)
    trip = await saved(api)
    total = trip["plan"]["total_cost"]
    first = trip["items"][0]

    edited = (await api.patch(f"{V1}/trips/{trip['id']}/items/{first['id']}", json={"title": "Sunrise at Chapora Fort", "est_cost": first["est_cost"] + 500})).json()
    assert edited["plan"]["itinerary"][0][first["slot"]] == "Sunrise at Chapora Fort"
    assert edited["plan"]["total_cost"] == total + 500

    added = (await api.post(f"{V1}/trips/{trip['id']}/items", json={"day_no": 1, "slot": "evening", "title": "Dinner at a beach shack", "est_cost": 800})).json()
    assert "Dinner at a beach shack" in added["plan"]["itinerary"][0]["evening"]
    assert added["plan"]["total_cost"] == total + 1300

    new_item = next(i for i in added["items"] if i["title"] == "Dinner at a beach shack")
    removed = (await api.delete(f"{V1}/trips/{trip['id']}/items/{new_item['id']}")).json()
    assert removed["plan"]["total_cost"] == total + 500
    assert all(i["id"] != new_item["id"] for i in removed["items"])
    bad = await api.post(f"{V1}/trips/{trip['id']}/items", json={"day_no": 1, "slot": "night", "title": "x"})
    assert bad.status_code == 422


async def test_exact_prices_are_saved_with_the_trip(api):
    await signed_up(api)
    query, p = await plan(api)
    pricing = {"origin": "Mumbai", "total": 31250, "checkedAt": "2026-11-04T10:00:00Z", "response": {"is_sample": True}, "selection": {"transport": 0}}
    trip = (await api.post(f"{V1}/trips", json={"query": query, "plan": p, "pricing": pricing})).json()
    assert trip["pricing"]["total"] == 31250 and trip["has_pricing"]
    newer = (await api.post(f"{V1}/trips/{trip['id']}/prices", json={**pricing, "total": 29900, "checkedAt": "2026-11-05T10:00:00Z"})).json()
    assert newer["pricing"]["total"] == 29900


async def test_share_links_show_a_read_only_copy_until_turned_off(api):
    await signed_up(api)
    trip = await saved(api)
    share = (await api.post(f"{V1}/trips/{trip['id']}/shares")).json()
    token = share["token"]
    assert token and (await api.get(f"{V1}/trips/{trip['id']}/shares")).json()[0].get("token") is None

    async with second_browser(api) as stranger:  # not signed in
        view = await stranger.get(f"{V1}/shared/{token}")
        assert view.status_code == 200
        body = view.json()
        assert body["plan"]["destination"] == "Goa" and body["shared_by"] == "Asha"
        assert "email" not in str(body).lower()
        assert (await api.get(f"{V1}/trips/{trip['id']}/shares")).json()[0]["view_count"] == 1

        assert (await api.delete(f"{V1}/shares/{share['id']}")).status_code == 204
        assert (await stranger.get(f"{V1}/shared/{token}")).status_code == 404
        assert (await stranger.get(f"{V1}/shared/not-a-real-token")).status_code == 404


async def test_import_browser_trips(api):
    await signed_up(api)
    q1, p1 = await plan(api)
    q2, p2 = await plan(api, query="3 days in Hampi for 2 people under 12000, history", dates=False)
    res = await api.post(f"{V1}/trips/import", json={"trips": [{"query": q1, "plan": p1}, {"query": q2, "plan": p2, "pricing": {"total": 9000}}]})
    assert res.json() == {"imported": 2}
    assert (await api.get(f"{V1}/trips")).json()["total"] == 2


async def test_deleting_the_account_deletes_its_trips(api, db):
    await signed_up(api)
    await saved(api)
    await api.request("DELETE", f"{V1}/users/me", json={"password": "trek-manali-26"})
    for model in (Trip, PlanVersion, ItineraryItem):
        assert await db.scalar(select(func.count()).select_from(model)) == 0
