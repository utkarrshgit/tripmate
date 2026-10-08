from datetime import date
from sqlalchemy import Date, Float, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    destination: Mapped[str] = mapped_column(String(150))
    days: Mapped[int] = mapped_column(Integer)
    travelers: Mapped[int] = mapped_column(Integer, default=1)
    budget: Mapped[float] = mapped_column(Float, default=0)
    query: Mapped[str] = mapped_column(Text)
