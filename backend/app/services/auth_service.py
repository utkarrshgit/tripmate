"""
Accounts: sign-up with a 6-digit email code, log-in, sessions, password reset and
email change. Routes call these; they raise AppError with messages the website shows.

Rules (the same as the website's stand-in and the blueprint):
  codes       6 digits, 10 minutes, 5 wrong tries, a new one after 60 s, at most 5 an hour
  log-in      5 failures for one email in 15 minutes locks it until the oldest is 15 minutes old
  sessions    30 days, renewed when used; a password change or reset ends the others
  unverified  no session until the code is entered; dropped after 24 hours
"""

import ipaddress
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.config import settings
from app.core.errors import AppError
from app.models import AuthCode, LoginAttempt, Session, Trip, User
from app.services import mail

CODE_TTL = timedelta(minutes=10)
MAX_TRIES = 5
RESEND_AFTER = timedelta(seconds=60)
MAX_CODES_PER_HOUR = 5
LOGIN_LIMIT = 5
LOGIN_WINDOW = timedelta(minutes=15)
UNVERIFIED_TTL = timedelta(hours=24)
SESSION_RENEW_WHEN_LEFT = timedelta(days=15)

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
# Development only (DEV_SHOW_CODES): the last code sent per (purpose, address), so a resend
# inside the 60-second wait can still show it. Never used in production.
_dev_codes: dict[tuple[str, str], str] = {}


def now() -> datetime:
    return datetime.now(timezone.utc)


def normalise_email(email: str) -> str:
    return email.strip().lower()


def check_email(email: str, field: str = "email") -> str:
    email = normalise_email(email)
    if not _EMAIL_RE.match(email):
        raise AppError(422, "invalid_email", "Enter an email address, like name@example.com.", field)
    return email


def check_name(name: str) -> str:
    name = name.strip()
    if not name:
        raise AppError(422, "name_missing", "Enter your name.", "name")
    return name


def check_new_password(password: str, email: str, field: str = "password") -> None:
    problem = security.password_problem(password, email)
    if problem:
        raise AppError(422, "weak_password", problem, field)


def safe_ip(raw: str | None) -> str | None:
    try:
        return str(ipaddress.ip_address(raw)) if raw else None
    except ValueError:
        return None


async def user_by_email(db: AsyncSession, email: str) -> User | None:
    return await db.scalar(select(User).where(User.email == normalise_email(email)))


async def drop_stale_unverified(db: AsyncSession) -> None:
    await db.execute(delete(User).where(User.email_verified_at.is_(None), User.created_at < now() - UNVERIFIED_TTL))


# ---- Codes -----------------------------------------------------------------


@dataclass
class Sent:
    email: str
    purpose: str
    resend_at: datetime
    dev_code: str | None = None

    def out(self) -> dict:
        return {"email": self.email, "purpose": self.purpose, "resend_at": self.resend_at, "dev_code": self.dev_code}


async def send_code(db: AsyncSession, user: User, purpose: str, sent_to: str, *, cooldown: bool = True) -> Sent:
    """Sends a new code, cancelling earlier unused ones. Raises 429 inside the 60-second wait or past 5 an hour."""
    recent = (
        await db.scalars(
            select(AuthCode)
            .where(AuthCode.user_id == user.id, AuthCode.purpose == purpose, AuthCode.created_at > now() - timedelta(hours=1))
            .order_by(AuthCode.created_at.desc())
        )
    ).all()
    if cooldown and recent and recent[0].created_at > now() - RESEND_AFTER:
        resend_at = recent[0].created_at + RESEND_AFTER
        seconds = max(1, int((resend_at - now()).total_seconds()) + 1)
        raise AppError(
            429,
            "resend_too_soon",
            f"You can send a new code in {seconds} seconds.",
            resend_at=resend_at.isoformat(),
            dev_code=_dev_codes.get((purpose, sent_to)) if settings.dev_show_codes else None,
        )
    if len(recent) >= MAX_CODES_PER_HOUR:
        raise AppError(429, "too_many_codes", "We've sent the most codes allowed for an hour. Try again later.")

    await db.execute(
        update(AuthCode).where(AuthCode.user_id == user.id, AuthCode.purpose == purpose, AuthCode.used_at.is_(None)).values(used_at=now())
    )
    code = security.new_code()
    row = AuthCode(
        user_id=user.id,
        purpose=purpose,
        sent_to=sent_to,
        code_hash=security.hash_code(code, purpose, sent_to),
        expires_at=now() + CODE_TTL,
    )
    db.add(row)
    await db.flush()
    await db.refresh(row, ["created_at"])
    await mail.send_code(sent_to, code, purpose)
    if settings.dev_show_codes:
        _dev_codes[(purpose, sent_to)] = code
    return Sent(sent_to, purpose, row.created_at + RESEND_AFTER, code if settings.dev_show_codes else None)


async def check_code(db: AsyncSession, user: User | None, purpose: str, code: str, *, sent_to: str | None = None, consume: bool = True) -> AuthCode:
    """Checks the latest unused code. A wrong code counts a try (saved even though this raises)."""
    entry = None
    if user is not None:
        query = select(AuthCode).where(AuthCode.user_id == user.id, AuthCode.purpose == purpose, AuthCode.used_at.is_(None))
        if sent_to:
            query = query.where(AuthCode.sent_to == sent_to)
        entry = await db.scalar(query.order_by(AuthCode.created_at.desc()).limit(1))
    if entry is None:
        raise AppError(400, "code_missing", "Send a new code to try again.", "code")
    if entry.expires_at < now():
        raise AppError(400, "code_expired", "This code has expired. Send a new code.", "code")
    if entry.attempts >= MAX_TRIES:
        raise AppError(400, "code_locked", "Too many incorrect codes. Send a new code to try again.", "code")
    if not security.same(entry.code_hash, security.hash_code(code.strip(), purpose, entry.sent_to)):
        entry.attempts += 1
        await db.commit()
        left = MAX_TRIES - entry.attempts
        if left <= 0:
            raise AppError(400, "code_locked", "Too many incorrect codes. Send a new code to try again.", "code")
        tries = "try" if left == 1 else "tries"
        raise AppError(
            400, "code_wrong", f"That code doesn't match. Check the email and enter it again. You have {left} {tries} left.", "code", tries_left=left
        )
    if consume:
        entry.used_at = now()
    return entry


# ---- Sessions --------------------------------------------------------------


async def start_session(db: AsyncSession, user: User, *, user_agent: str | None, ip: str | None) -> str:
    """Creates a session and returns the cookie value (only its hash is stored)."""
    token = security.new_token()
    db.add(
        Session(
            user_id=user.id,
            token_hash=security.hash_token(token),
            user_agent=(user_agent or "")[:300] or None,
            ip=safe_ip(ip),
            expires_at=now() + timedelta(days=settings.session_days),
        )
    )
    return token


async def session_for_token(db: AsyncSession, token: str | None) -> Session | None:
    if not token:
        return None
    session = await db.scalar(select(Session).where(Session.token_hash == security.hash_token(token)))
    if session is None or session.revoked_at or session.expires_at < now():
        return None
    return session


async def end_sessions(db: AsyncSession, user_id, *, except_id=None) -> None:
    query = update(Session).where(Session.user_id == user_id, Session.revoked_at.is_(None))
    if except_id is not None:
        query = query.where(Session.id != except_id)
    await db.execute(query.values(revoked_at=now()))


# ---- Sign-up and log-in ----------------------------------------------------


async def sign_up(db: AsyncSession, name: str, email: str, password: str) -> Sent:
    name, email = check_name(name), check_email(email)
    check_new_password(password, email)
    await drop_stale_unverified(db)
    user = await user_by_email(db, email)
    if user and user.email_verified_at:
        raise AppError(409, "email_taken", "An account with this email already exists. Log in instead.", "email")
    if user:  # signing up again before verifying starts over
        user.name, user.password_hash = name, security.hash_password(password)
    else:
        user = User(name=name, email=email, password_hash=security.hash_password(password))
        db.add(user)
        await db.flush()
    # A repeat sign-up skips the 60-second wait, but still counts toward 5 codes an hour.
    sent = await send_code(db, user, "verify_email", email, cooldown=False)
    await db.commit()
    return sent


async def verify_email(db: AsyncSession, email: str, code: str, *, user_agent, ip) -> tuple[User, str]:
    user = await user_by_email(db, email)
    await check_code(db, user, "verify_email", code)
    user.email_verified_at = user.email_verified_at or now()
    token = await start_session(db, user, user_agent=user_agent, ip=ip)
    await db.commit()
    return user, token


async def log_in(db: AsyncSession, email: str, password: str, *, user_agent, ip) -> tuple[User | None, str | None, Sent | None]:
    """Returns (user, token, None) when signed in, or (None, None, sent) when the email needs its code."""
    email = normalise_email(email)
    await drop_stale_unverified(db)
    last_ok = await db.scalar(select(func.max(LoginAttempt.at)).where(LoginAttempt.email == email, LoginAttempt.ok.is_(True)))
    # Failures in the last 15 minutes, counting only those after the last successful log-in.
    since = max(now() - LOGIN_WINDOW, last_ok) if last_ok else now() - LOGIN_WINDOW
    failures = (
        await db.scalars(
            select(LoginAttempt.at)
            .where(LoginAttempt.email == email, LoginAttempt.ok.is_(False), LoginAttempt.at > since)
            .order_by(LoginAttempt.at)
        )
    ).all()
    if len(failures) >= LOGIN_LIMIT:
        minutes = max(1, int((failures[0] + LOGIN_WINDOW - now()).total_seconds() // 60) + 1)
        unit = "minute" if minutes == 1 else "minutes"
        raise AppError(429, "login_locked", f"Too many attempts. Try again in {minutes} {unit}, or reset your password.", retry_after_minutes=minutes)

    user = await user_by_email(db, email)
    ok = security.verify_password(password, user.password_hash if user else None)
    db.add(LoginAttempt(email=email, user_id=user.id if user else None, ip=safe_ip(ip), ok=ok))
    if not ok:
        await db.commit()
        raise AppError(401, "bad_credentials", "Email or password is incorrect.")
    if user.disabled_at:
        await db.commit()
        raise AppError(403, "account_disabled", "This account is turned off. Contact support to turn it back on.")
    if not user.email_verified_at:
        try:
            sent = await send_code(db, user, "verify_email", email)
        except AppError as err:
            if err.code != "resend_too_soon":
                raise
            # A code sent moments ago still works: go to the code step without a new one.
            sent = Sent(email, "verify_email", datetime.fromisoformat(err.extra["resend_at"]), err.extra.get("dev_code"))
        await db.commit()
        return None, None, sent
    token = await start_session(db, user, user_agent=user_agent, ip=ip)
    await db.commit()
    return user, token, None


async def resend_code(db: AsyncSession, email: str, purpose: str, *, current: User | None = None) -> Sent:
    email = normalise_email(email)
    if purpose == "change_email":
        if current is None:
            raise AppError(401, "signed_out", "Log in to change your email.")
        sent = await send_code(db, current, purpose, email)
    else:
        user = await user_by_email(db, email)
        if user is None:  # the same answer whether or not the account exists
            return Sent(email, purpose, now() + RESEND_AFTER)
        sent = await send_code(db, user, purpose, email)
    await db.commit()
    return sent


# ---- Password reset --------------------------------------------------------


async def request_password_reset(db: AsyncSession, email: str) -> Sent:
    email = check_email(email)
    user = await user_by_email(db, email)
    if user is None:
        return Sent(email, "reset_password", now() + RESEND_AFTER)
    try:
        sent = await send_code(db, user, "reset_password", email)
    except AppError as err:
        if err.code != "resend_too_soon":
            raise
        sent = Sent(email, "reset_password", datetime.fromisoformat(err.extra["resend_at"]), err.extra.get("dev_code"))
    await db.commit()
    return sent


async def check_reset_code(db: AsyncSession, email: str, code: str) -> None:
    await check_code(db, await user_by_email(db, email), "reset_password", code, consume=False)


async def reset_password(db: AsyncSession, email: str, code: str, password: str, *, user_agent, ip) -> tuple[User, str]:
    user = await user_by_email(db, email)
    await check_code(db, user, "reset_password", code)
    check_new_password(password, user.email)
    user.password_hash = security.hash_password(password)
    user.email_verified_at = user.email_verified_at or now()  # entering the code proves the email
    await end_sessions(db, user.id)
    token = await start_session(db, user, user_agent=user_agent, ip=ip)
    await db.commit()
    return user, token


# ---- Your account ----------------------------------------------------------


def require_password(user: User, password: str) -> None:
    if not security.verify_password(password, user.password_hash):
        raise AppError(401, "wrong_password", "That password is incorrect.", "password")


async def update_name(db: AsyncSession, user: User, name: str) -> User:
    user.name = check_name(name)
    await db.commit()
    return user


async def request_email_change(db: AsyncSession, user: User, new_email: str, password: str) -> Sent:
    new_email = check_email(new_email)
    require_password(user, password)
    if new_email == user.email:
        raise AppError(422, "same_email", "This is already your email.", "email")
    other = await user_by_email(db, new_email)
    if other and other.email_verified_at:
        raise AppError(409, "email_taken", "Another account uses this email. Enter a different one.", "email")
    sent = await send_code(db, user, "change_email", new_email)
    await db.commit()
    return sent


async def confirm_email_change(db: AsyncSession, user: User, new_email: str, code: str) -> User:
    new_email = normalise_email(new_email)
    await check_code(db, user, "change_email", code, sent_to=new_email)
    other = await user_by_email(db, new_email)
    if other and other.id != user.id:
        if other.email_verified_at:
            raise AppError(409, "email_taken", "Another account uses this email. Enter a different one.", "email")
        await db.delete(other)  # an abandoned sign-up holding the address
        await db.flush()
    old_email, user.email, user.email_verified_at = user.email, new_email, now()
    await db.commit()
    await mail.send_email_changed_notice(old_email, new_email)
    return user


async def change_password(db: AsyncSession, user: User, session: Session, current_password: str, new_password: str) -> None:
    require_password(user, current_password)
    check_new_password(new_password, user.email, field="new_password")
    user.password_hash = security.hash_password(new_password)
    await end_sessions(db, user.id, except_id=session.id)
    await db.commit()


async def list_sessions(db: AsyncSession, user: User, current: Session) -> list[dict]:
    rows = (
        await db.scalars(
            select(Session)
            .where(Session.user_id == user.id, Session.revoked_at.is_(None), Session.expires_at > now())
            .order_by(Session.last_seen_at.desc())
        )
    ).all()
    return [
        {"id": s.id, "user_agent": s.user_agent, "created_at": s.created_at, "last_seen_at": s.last_seen_at, "current": s.id == current.id}
        for s in rows
    ]


async def end_session(db: AsyncSession, user: User, session_id) -> None:
    row = await db.scalar(select(Session).where(Session.id == session_id, Session.user_id == user.id, Session.revoked_at.is_(None)))
    if row is None:
        raise AppError(404, "not_found", "That session has already ended.")
    row.revoked_at = now()
    await db.commit()


async def export_account(db: AsyncSession, user: User) -> dict:
    trips = (await db.scalars(select(Trip).where(Trip.user_id == user.id, Trip.deleted_at.is_(None)))).all()
    return {
        "account": {"name": user.name, "email": user.email, "created_at": user.created_at, "email_verified_at": user.email_verified_at},
        "trips": [
            {"id": t.id, "title": t.title, "start_date": t.start_date, "end_date": t.end_date, "travelers": t.travelers, "budget": t.budget}
            for t in trips
        ],
        "exported_at": now(),
    }


async def delete_account(db: AsyncSession, user: User, password: str) -> None:
    require_password(user, password)
    await db.delete(user)
    await db.commit()
