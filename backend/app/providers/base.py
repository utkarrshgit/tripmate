from typing import Protocol

from app.schemas.pricing import PriceQuote, PriceRequest


class ProviderUnavailable(Exception):
    """Raised when a provider can't answer (not configured, quota hit, upstream down)."""


class TransportPricer(Protocol):
    """Quotes exact transport prices (flights, trains, buses) for a trip."""

    name: str
    is_sample: bool

    async def quote(self, request: PriceRequest) -> list[PriceQuote]: ...


class StayPricer(Protocol):
    """Quotes exact accommodation prices for a trip."""

    name: str
    is_sample: bool

    async def quote(self, request: PriceRequest) -> list[PriceQuote]: ...
