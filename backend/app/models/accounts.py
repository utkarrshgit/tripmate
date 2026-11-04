"""Accounts: users, sessions, 6-digit email codes and log-in attempts."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import CITEXT, INET, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAt, Timestamps, UUIDPrimaryKey

CODE_PURPOSES = ("verify_email", "reset_password", "change_email")


class User(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('user', 'admin')", name="role"),)

    email: Mapped[str] = mapped_column(CITEXT, unique=True)
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(Text)  # Argon2id, never the password
    role: Mapped[str] = mapped_column(String(10), server_default="user")
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # null until the code is entered
    disabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # set by an admin

    sessions: Mapped[list["Session"]] = relationship(back_populates="user", cascade="all, delete-orphan", passive_deletes=True)


class Session(UUIDPrimaryKey, CreatedAt, Base):
    __tablename__ = "sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)  # SHA-256 of the cookie value
    user_agent: Mapped[str | None] = mapped_column(Text)
    ip: Mapped[str | None] = mapped_column(INET)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="sessions")


class AuthCode(UUIDPrimaryKey, CreatedAt, Base):
    __tablename__ = "auth_codes"
    __table_args__ = (
        CheckConstraint(f"purpose IN {CODE_PURPOSES}", name="purpose"),
        CheckConstraint("attempts >= 0", name="attempts"),
        Index("ix_auth_codes_user_purpose", "user_id", "purpose"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    purpose: Mapped[str] = mapped_column(String(20))
    sent_to: Mapped[str] = mapped_column(CITEXT)  # the new address for change_email
    code_hash: Mapped[str] = mapped_column(String(64))  # HMAC-SHA256 with OTP_SECRET, never the code
    attempts: Mapped[int] = mapped_column(Integer, server_default="0")  # wrong tries, max 5
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))  # 10 minutes after sending
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LoginAttempt(UUIDPrimaryKey, Base):
    __tablename__ = "login_attempts"
    __table_args__ = (Index("ix_login_attempts_email_at", "email", "at"),)

    email: Mapped[str] = mapped_column(CITEXT)  # kept even when there's no such account
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    ip: Mapped[str | None] = mapped_column(INET)
    ok: Mapped[bool] = mapped_column(Boolean)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
