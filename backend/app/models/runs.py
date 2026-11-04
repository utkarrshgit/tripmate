"""A record of every planning run and every model call, for the model activity page."""

import uuid

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAt, UUIDPrimaryKey


class AgentRun(UUIDPrimaryKey, CreatedAt, Base):
    __tablename__ = "agent_runs"
    __table_args__ = (CheckConstraint("status IN ('running', 'done', 'failed')", name="status"),)

    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)  # null when signed out
    version_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("plan_versions.id", ondelete="SET NULL"))
    request_text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), server_default="running")
    duration_ms: Mapped[int | None] = mapped_column(Integer)

    calls: Mapped[list["LlmCall"]] = relationship(back_populates="run", cascade="all, delete-orphan", passive_deletes=True)


class LlmCall(UUIDPrimaryKey, CreatedAt, Base):
    __tablename__ = "llm_calls"

    run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("agent_runs.id", ondelete="CASCADE"), index=True)
    agent: Mapped[str] = mapped_column(String(40))
    model: Mapped[str] = mapped_column(String(80))
    prompt_tokens: Mapped[int] = mapped_column(Integer, server_default="0")
    output_tokens: Mapped[int] = mapped_column(Integer, server_default="0")
    latency_ms: Mapped[int] = mapped_column(Integer)
    ok: Mapped[bool] = mapped_column(Boolean)  # false means the rule-based fallback was used

    run: Mapped[AgentRun] = relationship(back_populates="calls")
