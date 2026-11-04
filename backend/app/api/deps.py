"""Shared route dependencies: the database session and the signed-in user."""

from dataclasses import dataclass
from datetime import timedelta

from fastapi import Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import AppError
from app.db.session import get_session
from app.models import Session, User
from app.services.auth_service import SESSION_RENEW_WHEN_LEFT, now, session_for_token

DB = Depends(get_session)


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        settings.session_cookie,
        token,
        max_age=settings.session_days * 86400,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(settings.session_cookie, path="/", httponly=True, samesite="lax", secure=settings.cookie_secure)


@dataclass
class Current:
    user: User
    session: Session


async def current(request: Request, response: Response, db: AsyncSession = DB) -> Current:
    """The signed-in user, or 401. Renews a session in its second half, and notes when it was last used."""
    token = request.cookies.get(settings.session_cookie)
    session = await session_for_token(db, token)
    user = await db.get(User, session.user_id) if session else None
    if user is None or user.disabled_at or not user.email_verified_at:
        raise AppError(401, "signed_out", "Log in to continue.")
    changed = False
    if session.expires_at - now() < SESSION_RENEW_WHEN_LEFT:
        session.expires_at = now() + timedelta(days=settings.session_days)
        set_session_cookie(response, token)
        changed = True
    if now() - session.last_seen_at > timedelta(minutes=5):
        session.last_seen_at = now()
        changed = True
    if changed:
        await db.commit()
    return Current(user, session)


async def admin(cur: Current = Depends(current)) -> Current:
    if cur.user.role != "admin":
        raise AppError(403, "admins_only", "Only admins can do this.")
    return cur
