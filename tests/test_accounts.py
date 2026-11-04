"""The account API end to end: codes are read from the outgoing email, like a person would."""

import re
from datetime import timedelta

import httpx
import pytest
from sqlalchemy import select, update

from app.core.config import settings
from app.models import AuthCode, LoginAttempt, Session, User
from app.services import mail
from app.services.auth_service import now

pytestmark = pytest.mark.asyncio
V1 = "/api/v1"
PASSWORD = "trek-manali-26"


def last_code(to: str) -> str:
    msg = next(m for m in reversed(mail.outbox) if m["to"] == to)
    return re.match(r"(\d{6}) is your TripMate code", msg["subject"]).group(1)


def wrong(code: str) -> str:
    return f"{(int(code) + 1) % 1_000_000:06d}"


async def sign_up(api, email="asha@example.test", password=PASSWORD, name="Asha"):
    res = await api.post(f"{V1}/auth/signup", json={"name": name, "email": email, "password": password})
    assert res.status_code == 202, res.text
    return res


async def signed_up(api, email="asha@example.test", password=PASSWORD):
    """A verified, signed-in account."""
    await sign_up(api, email, password)
    res = await api.post(f"{V1}/auth/verify-email", json={"email": email, "code": last_code(email)})
    assert res.status_code == 200, res.text
    return res.json()


def second_browser(api) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=api._transport, base_url=api.base_url)


# ---- Sign-up and verification ----------------------------------------------


async def test_sign_up_sends_a_code_and_signs_in_only_after_it(api, db):
    res = await sign_up(api, email="Asha@Example.test ")
    body = res.json()
    assert body["email"] == "asha@example.test" and body["purpose"] == "verify_email"
    assert settings.session_cookie not in res.cookies
    code = last_code("asha@example.test")
    stored = await db.scalar(select(AuthCode))
    assert code not in stored.code_hash and len(stored.code_hash) == 64  # only an HMAC is kept

    assert (await api.get(f"{V1}/users/me")).status_code == 401
    res = await api.post(f"{V1}/auth/verify-email", json={"email": "asha@example.test", "code": code})
    assert res.status_code == 200
    assert res.json()["email_verified_at"]
    cookie = res.headers["set-cookie"]
    assert "HttpOnly" in cookie and "samesite=lax" in cookie.lower()
    assert (await api.get(f"{V1}/users/me")).json()["name"] == "Asha"
    token = api.cookies[settings.session_cookie]
    assert (await db.scalar(select(Session))).token_hash != token  # only the hash is stored


async def test_sign_up_checks_its_fields(api):
    cases = [
        ({"name": " ", "email": "a@example.test", "password": PASSWORD}, "name_missing", "name"),
        ({"name": "A", "email": "not-an-email", "password": PASSWORD}, "invalid_email", "email"),
        ({"name": "A", "email": "a@example.test", "password": "short"}, "weak_password", "password"),
        ({"name": "A", "email": "a@example.test", "password": "password1"}, "weak_password", "password"),
        ({"name": "A", "email": "same@example.test", "password": "same@example.test"}, "weak_password", "password"),
    ]
    for body, code, field in cases:
        err = (await api.post(f"{V1}/auth/signup", json=body)).json()["error"]
        assert (err["code"], err["field"]) == (code, field), body


async def test_a_verified_email_cant_sign_up_again(api):
    await signed_up(api)
    res = await api.post(f"{V1}/auth/signup", json={"name": "B", "email": "ASHA@example.test", "password": PASSWORD})
    assert res.status_code == 409 and res.json()["error"]["code"] == "email_taken"


async def test_wrong_codes_count_down_then_lock(api):
    await sign_up(api)
    code = last_code("asha@example.test")
    for left in (4, 3, 2, 1):
        err = (await api.post(f"{V1}/auth/verify-email", json={"email": "asha@example.test", "code": wrong(code)})).json()["error"]
        assert err["code"] == "code_wrong" and err["tries_left"] == left
    err = (await api.post(f"{V1}/auth/verify-email", json={"email": "asha@example.test", "code": wrong(code)})).json()["error"]
    assert err["code"] == "code_locked"
    # Even the right code doesn't work once locked.
    err = (await api.post(f"{V1}/auth/verify-email", json={"email": "asha@example.test", "code": code})).json()["error"]
    assert err["code"] == "code_locked"


async def test_an_expired_code_is_refused(api, db):
    await sign_up(api)
    code = last_code("asha@example.test")
    await db.execute(update(AuthCode).values(expires_at=now() - timedelta(seconds=1)))
    await db.commit()
    err = (await api.post(f"{V1}/auth/verify-email", json={"email": "asha@example.test", "code": code})).json()["error"]
    assert err["code"] == "code_expired"


async def test_resending_waits_a_minute_and_replaces_the_old_code(api, db):
    await sign_up(api)
    first = last_code("asha@example.test")
    res = await api.post(f"{V1}/auth/resend-code", json={"email": "asha@example.test", "purpose": "verify_email"})
    assert res.status_code == 429 and res.json()["error"]["code"] == "resend_too_soon"
    await db.execute(update(AuthCode).values(created_at=now() - timedelta(minutes=2)))
    await db.commit()
    assert (await api.post(f"{V1}/auth/resend-code", json={"email": "asha@example.test", "purpose": "verify_email"})).status_code == 202
    second = last_code("asha@example.test")
    if first != second:
        old = await api.post(f"{V1}/auth/verify-email", json={"email": "asha@example.test", "code": first})
        assert old.status_code == 400  # the earlier code stopped working
    assert (await api.post(f"{V1}/auth/verify-email", json={"email": "asha@example.test", "code": second})).status_code == 200


async def test_at_most_five_codes_an_hour(api, db):
    for _ in range(5):
        await sign_up(api)  # a repeat sign-up skips the wait but counts toward the hour
    res = await api.post(f"{V1}/auth/signup", json={"name": "Asha", "email": "asha@example.test", "password": PASSWORD})
    assert res.status_code == 429 and res.json()["error"]["code"] == "too_many_codes"


async def test_resending_for_an_unknown_email_looks_the_same(api):
    res = await api.post(f"{V1}/auth/resend-code", json={"email": "nobody@example.test", "purpose": "verify_email"})
    assert res.status_code == 202 and not mail.outbox


# ---- Log-in and sessions ---------------------------------------------------


async def test_log_in_before_verifying_goes_to_the_code_step(api, db):
    await sign_up(api)
    await db.execute(update(AuthCode).values(created_at=now() - timedelta(minutes=2)))
    await db.commit()
    res = await api.post(f"{V1}/auth/login", json={"email": "asha@example.test", "password": PASSWORD})
    assert res.status_code == 202 and res.json()["verify"]["purpose"] == "verify_email"
    assert settings.session_cookie not in res.cookies
    code = last_code("asha@example.test")
    assert (await api.post(f"{V1}/auth/verify-email", json={"email": "asha@example.test", "code": code})).status_code == 200


async def test_log_in_and_out(api):
    await signed_up(api)
    await api.post(f"{V1}/auth/logout")
    assert (await api.get(f"{V1}/users/me")).status_code == 401
    bad = await api.post(f"{V1}/auth/login", json={"email": "asha@example.test", "password": "wrong-password"})
    assert bad.status_code == 401 and bad.json()["error"]["code"] == "bad_credentials"
    unknown = await api.post(f"{V1}/auth/login", json={"email": "nobody@example.test", "password": PASSWORD})
    assert unknown.json()["error"] == bad.json()["error"]  # never says whether the email exists
    ok = await api.post(f"{V1}/auth/login", json={"email": "ASHA@example.test", "password": PASSWORD})
    assert ok.status_code == 200 and ok.json()["user"]["email"] == "asha@example.test"
    assert (await api.get(f"{V1}/users/me")).status_code == 200


async def test_five_failed_log_ins_lock_the_email(api, db):
    await signed_up(api)
    for _ in range(5):
        await api.post(f"{V1}/auth/login", json={"email": "asha@example.test", "password": "wrong-password"})
    res = await api.post(f"{V1}/auth/login", json={"email": "asha@example.test", "password": PASSWORD})
    assert res.status_code == 429 and res.json()["error"]["code"] == "login_locked"
    await db.execute(update(LoginAttempt).values(at=now() - timedelta(minutes=16)))
    await db.commit()
    assert (await api.post(f"{V1}/auth/login", json={"email": "asha@example.test", "password": PASSWORD})).status_code == 200


async def test_sessions_can_be_listed_and_ended(api):
    await signed_up(api)
    async with second_browser(api) as other:
        await other.post(f"{V1}/auth/login", json={"email": "asha@example.test", "password": PASSWORD})
        listed = (await api.get(f"{V1}/users/me/sessions")).json()
        assert len(listed) == 2 and sum(s["current"] for s in listed) == 1
        other_id = next(s["id"] for s in listed if not s["current"])
        assert (await api.delete(f"{V1}/users/me/sessions/{other_id}")).status_code == 204
        assert (await other.get(f"{V1}/users/me")).status_code == 401
        assert (await api.get(f"{V1}/users/me")).status_code == 200

        await other.post(f"{V1}/auth/login", json={"email": "asha@example.test", "password": PASSWORD})
        assert (await api.post(f"{V1}/auth/logout-all")).status_code == 204
        assert (await other.get(f"{V1}/users/me")).status_code == 401
        assert (await api.get(f"{V1}/users/me")).status_code == 401


# ---- Password reset --------------------------------------------------------


async def test_password_reset_by_code(api):
    await signed_up(api)
    async with second_browser(api) as other:
        await other.post(f"{V1}/auth/login", json={"email": "asha@example.test", "password": PASSWORD})
        res = await api.post(f"{V1}/auth/forgot-password", json={"email": "asha@example.test"})
        assert res.status_code == 202
        code = last_code("asha@example.test")
        bad = await api.post(f"{V1}/auth/reset-password/check", json={"email": "asha@example.test", "code": wrong(code)})
        assert bad.json()["error"]["tries_left"] == 4
        assert (await api.post(f"{V1}/auth/reset-password/check", json={"email": "asha@example.test", "code": code})).status_code == 204
        weak = await api.post(f"{V1}/auth/reset-password", json={"email": "asha@example.test", "code": code, "password": "short"})
        assert weak.json()["error"]["code"] == "weak_password"
        new = "backwaters-77"
        ok = await api.post(f"{V1}/auth/reset-password", json={"email": "asha@example.test", "code": code, "password": new})
        assert ok.status_code == 200
        assert (await other.get(f"{V1}/users/me")).status_code == 401  # other devices signed out
    await api.post(f"{V1}/auth/logout")
    assert (await api.post(f"{V1}/auth/login", json={"email": "asha@example.test", "password": PASSWORD})).status_code == 401
    assert (await api.post(f"{V1}/auth/login", json={"email": "asha@example.test", "password": "backwaters-77"})).status_code == 200


async def test_forgot_password_looks_the_same_for_unknown_emails(api):
    res = await api.post(f"{V1}/auth/forgot-password", json={"email": "nobody@example.test"})
    assert res.status_code == 202 and res.json()["purpose"] == "reset_password" and not mail.outbox


# ---- Your account ----------------------------------------------------------


async def test_rename_and_change_email(api):
    await signed_up(api)
    assert (await api.patch(f"{V1}/users/me", json={"name": "Asha K"})).json()["name"] == "Asha K"
    await signed_up(second_browser(api), email="ravi@example.test")  # an address another account uses

    taken = await api.post(f"{V1}/users/me/email", json={"new_email": "ravi@example.test", "password": PASSWORD})
    assert taken.status_code == 409
    wrong_pw = await api.post(f"{V1}/users/me/email", json={"new_email": "asha.new@example.test", "password": "nope-nope"})
    assert wrong_pw.status_code == 401 and wrong_pw.json()["error"]["field"] == "password"
    assert (await api.post(f"{V1}/users/me/email", json={"new_email": "asha.new@example.test", "password": PASSWORD})).status_code == 202

    code = last_code("asha.new@example.test")
    res = await api.post(f"{V1}/users/me/email/verify", json={"new_email": "asha.new@example.test", "code": code})
    assert res.status_code == 200 and res.json()["email"] == "asha.new@example.test"
    assert mail.outbox[-1]["to"] == "asha@example.test" and "was changed" in mail.outbox[-1]["subject"]


async def test_change_password_ends_other_sessions(api):
    await signed_up(api)
    async with second_browser(api) as other:
        await other.post(f"{V1}/auth/login", json={"email": "asha@example.test", "password": PASSWORD})
        bad = await api.post(f"{V1}/users/me/password", json={"current_password": "nope-nope", "new_password": "backwaters-77"})
        assert bad.status_code == 401
        ok = await api.post(f"{V1}/users/me/password", json={"current_password": PASSWORD, "new_password": "backwaters-77"})
        assert ok.status_code == 204
        assert (await other.get(f"{V1}/users/me")).status_code == 401
        assert (await api.get(f"{V1}/users/me")).status_code == 200


async def test_export_and_delete_account(api, db):
    await signed_up(api)
    export = (await api.get(f"{V1}/users/me/export")).json()
    assert export["account"]["email"] == "asha@example.test" and export["trips"] == []
    assert (await api.request("DELETE", f"{V1}/users/me", json={"password": "nope-nope"})).status_code == 401
    assert (await api.request("DELETE", f"{V1}/users/me", json={"password": PASSWORD})).status_code == 204
    assert await db.scalar(select(User)) is None
    assert await db.scalar(select(Session)) is None


async def test_errors_share_one_shape(api):
    res = await api.post(f"{V1}/auth/signup", json={"email": "a@example.test"})
    assert res.status_code == 422
    err = res.json()["error"]
    assert err["code"] == "invalid" and {"name", "password"} <= set(err["fields"])


# ---- Admin -----------------------------------------------------------------


async def make_admin(db, email):
    await db.execute(update(User).where(User.email == email).values(role="admin"))
    await db.commit()


async def test_admin_manages_accounts(api, db):
    await signed_up(api, email="admin@example.test")
    async with second_browser(api) as other:
        ravi = await signed_up(other, email="ravi@example.test")
        assert (await other.get(f"{V1}/admin/users")).status_code == 403
        await make_admin(db, "admin@example.test")

        page = (await api.get(f"{V1}/admin/users", params={"q": "ravi"})).json()
        assert page["total"] == 1 and page["users"][0]["trip_count"] == 0

        off = await api.patch(f"{V1}/admin/users/{ravi['id']}", json={"disabled": True})
        assert off.status_code == 200 and off.json()["disabled_at"]
        assert (await other.get(f"{V1}/users/me")).status_code == 401
        res = await other.post(f"{V1}/auth/login", json={"email": "ravi@example.test", "password": PASSWORD})
        assert res.status_code == 403 and res.json()["error"]["code"] == "account_disabled"

        me = (await api.get(f"{V1}/users/me")).json()
        last = await api.patch(f"{V1}/admin/users/{me['id']}", json={"role": "user"})
        assert last.status_code == 409 and last.json()["error"]["code"] == "last_admin"
        assert (await api.delete(f"{V1}/admin/users/{ravi['id']}")).status_code == 204
        assert (await api.get(f"{V1}/admin/users/{ravi['id']}")).status_code == 404
