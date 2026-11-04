"""Admin account management: find, change role, turn off or on, and delete users."""

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models import Trip, User
from app.services.auth_service import end_sessions, now


def _row(user: User, trip_count: int) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "email_verified_at": user.email_verified_at,
        "created_at": user.created_at,
        "disabled_at": user.disabled_at,
        "trip_count": trip_count,
    }


def _trip_count():
    return select(func.count()).select_from(Trip).where(Trip.user_id == User.id, Trip.deleted_at.is_(None)).scalar_subquery()


async def list_users(db: AsyncSession, q: str | None, role: str | None, page: int, per_page: int) -> dict:
    query = select(User, _trip_count())
    count = select(func.count()).select_from(User)
    if q:
        like = f"%{q.strip()}%"
        cond = or_(User.email.ilike(like), User.name.ilike(like))
        query, count = query.where(cond), count.where(cond)
    if role:
        query, count = query.where(User.role == role), count.where(User.role == role)
    rows = (await db.execute(query.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page))).all()
    return {"users": [_row(u, n) for u, n in rows], "page": page, "per_page": per_page, "total": await db.scalar(count)}


async def get_user(db: AsyncSession, user_id) -> dict:
    row = (await db.execute(select(User, _trip_count()).where(User.id == user_id))).first()
    if row is None:
        raise AppError(404, "not_found", "There's no user with that ID.")
    return _row(*row)


async def _active_admins(db: AsyncSession) -> int:
    return await db.scalar(select(func.count()).select_from(User).where(User.role == "admin", User.disabled_at.is_(None)))


async def _guard_last_admin(db: AsyncSession, user: User) -> None:
    if user.role == "admin" and not user.disabled_at and await _active_admins(db) <= 1:
        raise AppError(409, "last_admin", "TripMate needs at least one admin. Make someone else an admin first.")


async def update_user(db: AsyncSession, user_id, role: str | None, disabled: bool | None) -> dict:
    user = await db.get(User, user_id)
    if user is None:
        raise AppError(404, "not_found", "There's no user with that ID.")
    if (role == "user" and user.role == "admin") or disabled:
        await _guard_last_admin(db, user)
    if role:
        user.role = role
    if disabled is True and not user.disabled_at:
        user.disabled_at = now()
        await end_sessions(db, user.id)
    elif disabled is False:
        user.disabled_at = None
    await db.commit()
    return await get_user(db, user_id)


async def delete_user(db: AsyncSession, user_id) -> None:
    user = await db.get(User, user_id)
    if user is None:
        raise AppError(404, "not_found", "There's no user with that ID.")
    await _guard_last_admin(db, user)
    await db.delete(user)
    await db.commit()
