"""/api/v1/auth: sign-up with a 6-digit code, log-in, log-out and password reset. Open to anyone."""

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DB, Current, clear_session_cookie, current, set_session_cookie
from app.core.config import settings
from app.schemas.accounts import (
    CodeSent,
    EmailCodeIn,
    EmailIn,
    LoginResult,
    LogInIn,
    ResendIn,
    ResetIn,
    SignUpIn,
    UserOut,
)
from app.services import auth_service as auth
from app.services.auth_service import session_for_token

router = APIRouter(prefix="/auth", tags=["auth"])


def client(request: Request) -> dict:
    return {"user_agent": request.headers.get("user-agent"), "ip": request.client.host if request.client else None}


@router.post("/signup", status_code=202, response_model=CodeSent)
async def sign_up(body: SignUpIn, db: AsyncSession = DB):
    """Creates an unverified account and emails a code. No session until the code is entered."""
    return (await auth.sign_up(db, body.name, body.email, body.password)).out()


@router.post("/verify-email", response_model=UserOut)
async def verify_email(body: EmailCodeIn, request: Request, response: Response, db: AsyncSession = DB):
    user, token = await auth.verify_email(db, body.email, body.code, **client(request))
    set_session_cookie(response, token)
    return user


@router.post("/resend-code", status_code=202, response_model=CodeSent)
async def resend_code(body: ResendIn, request: Request, db: AsyncSession = DB):
    signed_in = None
    if body.purpose == "change_email":
        session = await session_for_token(db, request.cookies.get(settings.session_cookie))
        signed_in = await db.get(auth.User, session.user_id) if session else None
    return (await auth.resend_code(db, body.email, body.purpose, current=signed_in)).out()


@router.post("/login", response_model=LoginResult)
async def log_in(body: LogInIn, request: Request, db: AsyncSession = DB):
    """200 with `user` and a session cookie, or 202 with `verify` when the email still needs its code."""
    user, token, sent = await auth.log_in(db, body.email, body.password, **client(request))
    if sent:
        return JSONResponse(LoginResult(verify=CodeSent(**sent.out())).model_dump(mode="json"), status_code=202)
    result = JSONResponse(LoginResult(user=UserOut.model_validate(user)).model_dump(mode="json"))
    set_session_cookie(result, token)
    return result


@router.post("/logout", status_code=204)
async def log_out(request: Request, db: AsyncSession = DB):
    """Ends this session. Safe to call when already signed out."""
    session = await session_for_token(db, request.cookies.get(settings.session_cookie))
    if session:
        session.revoked_at = auth.now()
        await db.commit()
    response = Response(status_code=204)
    clear_session_cookie(response)
    return response


@router.post("/logout-all", status_code=204)
async def log_out_everywhere(cur: Current = Depends(current), db: AsyncSession = DB):
    await auth.end_sessions(db, cur.user.id)
    await db.commit()
    response = Response(status_code=204)
    clear_session_cookie(response)
    return response


@router.post("/forgot-password", status_code=202, response_model=CodeSent)
async def forgot_password(body: EmailIn, db: AsyncSession = DB):
    """The same answer whether or not the account exists."""
    return (await auth.request_password_reset(db, body.email)).out()


@router.post("/reset-password/check", status_code=204)
async def check_reset_code(body: EmailCodeIn, db: AsyncSession = DB):
    """Checks the code before the new-password step. Counts a wrong try but doesn't use the code up."""
    await auth.check_reset_code(db, body.email, body.code)
    return Response(status_code=204)


@router.post("/reset-password", response_model=UserOut)
async def reset_password(body: ResetIn, request: Request, response: Response, db: AsyncSession = DB):
    """Sets the new password, ends every other session, and signs in."""
    user, token = await auth.reset_password(db, body.email, body.code, body.password, **client(request))
    set_session_cookie(response, token)
    return user
