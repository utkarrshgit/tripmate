"""Saved trips, their plan versions, itinerary items, price checks and share links."""

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Table, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAt, Timestamps, UUIDPrimaryKey

SLOTS = ("morning", "afternoon", "evening")
VERSION_SOURCES = ("plan", "revise", "restore")

trip_interests = Table(
    "trip_interests",
    Base.metadata,
    Column("trip_id", UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), primary_key=True),
    Column("interest_id", UUID(as_uuid=True), ForeignKey("interests.id", ondelete="CASCADE"), primary_key=True),
)


class Trip(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "trips"
    __table_args__ = (
        CheckConstraint("status IN ('saved', 'archived')", name="status"),
        CheckConstraint("travelers >= 1", name="travelers"),
        CheckConstraint("budget >= 0", name="budget"),
        CheckConstraint("end_date IS NULL OR start_date IS NULL OR end_date >= start_date", name="dates"),
        Index("ix_trips_user_deleted", "user_id", "deleted_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    destination_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("destinations.id", ondelete="SET NULL"))  # null if not in the catalog
    title: Mapped[str] = mapped_column(String(150))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    travelers: Mapped[int] = mapped_column(Integer, server_default="1")
    budget: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default="0")
    status: Mapped[str] = mapped_column(String(10), server_default="saved")
    # The version being shown. use_alter breaks the trips ↔ plan_versions cycle when creating tables.
    current_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("plan_versions.id", ondelete="SET NULL", use_alter=True)
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # in the trash for 30 days

    versions: Mapped[list["PlanVersion"]] = relationship(
        back_populates="trip", foreign_keys="PlanVersion.trip_id", cascade="all, delete-orphan", passive_deletes=True
    )


class PlanVersion(UUIDPrimaryKey, CreatedAt, Base):
    __tablename__ = "plan_versions"
    __table_args__ = (
        UniqueConstraint("trip_id", "version_no"),
        CheckConstraint(f"source IN {VERSION_SOURCES}", name="source"),
        CheckConstraint("version_no >= 1", name="version_no"),
    )

    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"))
    version_no: Mapped[int] = mapped_column(Integer)
    request_text: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(10))
    total_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    cost_breakdown: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    issues: Mapped[list] = mapped_column(JSONB, server_default="[]")
    # The planner's full response, so a saved trip shows exactly what was planned. Its day-by-day
    # itinerary is rebuilt from itinerary_items when read, so item edits show up.
    plan: Mapped[dict] = mapped_column(JSONB, server_default="{}")

    trip: Mapped[Trip] = relationship(back_populates="versions", foreign_keys=[trip_id])
    items: Mapped[list["ItineraryItem"]] = relationship(
        back_populates="version", cascade="all, delete-orphan", passive_deletes=True, order_by="[ItineraryItem.day_no, ItineraryItem.position]"
    )


class ItineraryItem(UUIDPrimaryKey, Base):
    __tablename__ = "itinerary_items"
    __table_args__ = (
        CheckConstraint(f"slot IN {SLOTS}", name="slot"),
        CheckConstraint("day_no >= 1", name="day_no"),
        CheckConstraint("est_cost >= 0", name="est_cost"),
        Index("ix_itinerary_items_version_day", "version_id", "day_no", "position"),
    )

    version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("plan_versions.id", ondelete="CASCADE"))
    day_no: Mapped[int] = mapped_column(Integer)
    slot: Mapped[str] = mapped_column(String(10))
    position: Mapped[int] = mapped_column(Integer, server_default="0")
    place_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("places.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(150))
    note: Mapped[str | None] = mapped_column(Text)
    est_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default="0")

    version: Mapped[PlanVersion] = relationship(back_populates="items")


class PriceQuote(UUIDPrimaryKey, Base):
    __tablename__ = "price_quotes"

    version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("plan_versions.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(40))
    category: Mapped[str] = mapped_column(String(20))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    details: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TripShare(UUIDPrimaryKey, CreatedAt, Base):
    __tablename__ = "trip_shares"

    trip_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    view_count: Mapped[int] = mapped_column(Integer, server_default="0")
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
