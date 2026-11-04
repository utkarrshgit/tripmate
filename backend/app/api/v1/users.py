"""/api/v1/users/me: your account, email and password, signed-in devices, export and deletion."""

import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DB, Current, clear_session_cookie, current
from app.schemas.accounts import CodeSent, EmailChangeIn, EmailChangeVerifyIn, NameIn, PasswordChangeIn, PasswordIn, SessionOut, UserOut
from app.services import auth_service as auth

router = APIRouter(prefix="/users/me", tags=["account"])


@router.get("", response_model=UserOut)
async def me(cur: Current = Depends(current)):
    return cur.user


@router.patch("", response_model=UserOut)
async def update_me(body: NameIn, cur: Current = Depends(current), db: AsyncSession = DB):
    return await auth.update_name(db, cur.user, body.name)


@router.post("/email", status_code=202, response_model=CodeSent)
async def change_email(body: EmailChangeIn, cur: Current = Depends(current), db: AsyncSession = DB):
    """Checks your password, then sends a code to the new address."""
    return (await auth.request_email_change(db, cur.user, body.new_email, body.password)).out()


@router.post("/email/verify", response_model=UserOut)
async def confirm_email(body: EmailChangeVerifyIn, cur: Current = Depends(current), db: AsyncSession = DB):
    """Switches to the new email once its code is entered. The old address gets a notice."""
    return await auth.confirm_email_change(db, cur.user, body.new_email, body.code)


@router.post("/password", status_code=204)
async def change_password(body: PasswordChangeIn, cur: Current = Depends(current), db: AsyncSession = DB):
    """Changes the password and signs out every other device."""
    await auth.change_password(db, cur.user, cur.session, body.current_password, body.new_password)
    return Response(status_code=204)


@router.get("/sessions", response_model=list[SessionOut])
async def sessions(cur: Current = Depends(current), db: AsyncSession = DB):
    return await auth.list_sessions(db, cur.user, cur.session)


@router.delete("/sessions/{session_id}", status_code=204)
async def end_session(session_id: uuid.UUID, cur: Current = Depends(current), db: AsyncSession = DB):
    await auth.end_session(db, cur.user, session_id)
    return Response(status_code=204)


@router.get("/export")
async def export(cur: Current = Depends(current), db: AsyncSession = DB):
    """Everything TripMate holds about you, as JSON."""
    return await auth.export_account(db, cur.user)


@router.delete("", status_code=204)
async def delete_me(body: PasswordIn, cur: Current = Depends(current), db: AsyncSession = DB):
    """Deletes the account and everything it owns, after checking the password."""
    await auth.delete_account(db, cur.user, body.password)
    response = Response(status_code=204)
    clear_session_cookie(response)
    return response
