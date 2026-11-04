"""The destination catalog: the places the AI is allowed to choose from."""

import uuid
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, Float, ForeignKey, Integer, Numeric, String, Table, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKey

PLACE_KINDS = ("activity", "food", "stay")

destination_interests = Table(
    "destination_interests",
    Base.metadata,
    Column("destination_id", UUID(as_uuid=True), ForeignKey("destinations.id", ondelete="CASCADE"), primary_key=True),
    Column("interest_id", UUID(as_uuid=True), ForeignKey("interests.id", ondelete="CASCADE"), primary_key=True),
)


class Interest(UUIDPrimaryKey, Base):
    __tablename__ = "interests"

    slug: Mapped[str] = mapped_column(String(40), unique=True)
    label: Mapped[str] = mapped_column(String(60))


class Destination(UUIDPrimaryKey, Base):
    __tablename__ = "destinations"

    slug: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(100))
    summary: Mapped[str] = mapped_column(Text)
    best_months: Mapped[list[int]] = mapped_column(ARRAY(Integer))  # 1–12
    avg_daily_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2))  # rupees per person per day, an estimate
    # Search by meaning. A plain array until pgvector is installed; compared in Python meanwhile.
    embedding: Mapped[list[float] | None] = mapped_column(ARRAY(Float))

    places: Mapped[list["Place"]] = relationship(back_populates="destination", cascade="all, delete-orphan", passive_deletes=True)
    interests: Mapped[list[Interest]] = relationship(secondary=destination_interests)


class Place(UUIDPrimaryKey, Base):
    __tablename__ = "places"
    __table_args__ = (
        CheckConstraint(f"kind IN {PLACE_KINDS}", name="kind"),
        CheckConstraint("est_cost >= 0", name="est_cost"),
    )

    destination_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("destinations.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(10))
    name: Mapped[str] = mapped_column(String(150))
    est_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2))  # rupees per person, an estimate
    duration_hours: Mapped[Decimal] = mapped_column(Numeric(4, 1))
    tags: Mapped[list[str]] = mapped_column(ARRAY(String(40)), server_default="{}")  # interest slugs

    destination: Mapped[Destination] = relationship(back_populates="places")
