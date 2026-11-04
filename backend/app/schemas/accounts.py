"""Request and response shapes for the account endpoints (/api/v1/auth, /users/me, /admin/users)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Purpose = Literal["verify_email", "reset_password", "change_email"]


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    role: str
    email_verified_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CodeSent(BaseModel):
    """A code went out (or would have). `dev_code` is set only when DEV_SHOW_CODES is on."""

    email: str
    purpose: Purpose
    resend_at: datetime
    dev_code: str | None = None


class LoginResult(BaseModel):
    """Either signed in (`user`) or the email still needs its code (`verify`)."""

    user: UserOut | None = None
    verify: CodeSent | None = None


class SignUpIn(BaseModel):
    name: str = Field(max_length=100)
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)


class LogInIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)


class EmailIn(BaseModel):
    email: str = Field(max_length=254)


class EmailCodeIn(BaseModel):
    email: str = Field(max_length=254)
    code: str = Field(max_length=12)


class ResendIn(BaseModel):
    email: str = Field(max_length=254)
    purpose: Purpose


class ResetIn(BaseModel):
    email: str = Field(max_length=254)
    code: str = Field(max_length=12)
    password: str = Field(max_length=200)


class NameIn(BaseModel):
    name: str = Field(max_length=100)


class EmailChangeIn(BaseModel):
    new_email: str = Field(max_length=254)
    password: str = Field(max_length=200)


class EmailChangeVerifyIn(BaseModel):
    new_email: str = Field(max_length=254)
    code: str = Field(max_length=12)


class PasswordChangeIn(BaseModel):
    current_password: str = Field(max_length=200)
    new_password: str = Field(max_length=200)


class PasswordIn(BaseModel):
    password: str = Field(max_length=200)


class SessionOut(BaseModel):
    id: uuid.UUID
    user_agent: str | None
    created_at: datetime
    last_seen_at: datetime
    current: bool


class AdminUserOut(UserOut):
    disabled_at: datetime | None
    trip_count: int = 0


class AdminUserPage(BaseModel):
    users: list[AdminUserOut]
    page: int
    per_page: int
    total: int


class AdminUserPatch(BaseModel):
    role: Literal["user", "admin"] | None = None
    disabled: bool | None = None
