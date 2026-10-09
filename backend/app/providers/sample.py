"""
Sample pricing provider — FOR DEVELOPMENT ONLY.

Generates believable but made-up prices so the exact-pricing flow can be built
and tested before real provider keys exist. Every response is flagged
`is_sample=True` and the UI says so. Prices are deterministic for the same
trip, vary with how far ahead the trip is, and never name real airlines or hotels.
"""

import hashlib
from datetime import date

from app.schemas.pricing import PriceQuote, PriceRequest


def _jitter(*parts: object, spread: float = 0.25) -> float:
    """A stable multiplier in [1 - spread, 1 + spread] for the given inputs."""
    digest = hashlib.sha256("|".join(map(str, parts)).encode()).digest()
    return 1 - spread + (digest[0] / 255) * 2 * spread


def _lead_time_factor(start: date) -> float:
    """Trips booked late cost more: up to +35% inside a week, flat beyond two months."""
    days_ahead = max((start - date.today()).days, 0)
    return 1 + max(0.0, 60 - days_ahead) / 60 * 0.35


class SampleTransportPricer:
    name = "sample"
    is_sample = True

    async def quote(self, request: PriceRequest) -> list[PriceQuote]:
        if not request.origin:
            return []
        factor = _lead_time_factor(request.start_date)
        key = (request.origin.lower(), request.destination.lower(), request.start_date)
        per_person = [
            ("Morning flight", "Non-stop · return", 5200 * _jitter(*key, "am") * factor),
            ("Evening flight", "1 stop · return", 4300 * _jitter(*key, "pm") * factor),
            ("Train", "AC 3-tier · return", 1900 * _jitter(*key, "rail")),
        ]
        return [
            PriceQuote(kind="transport", name=name, detail=detail, price=round(price * request.travelers, -1))
            for name, detail, price in per_person
        ]


class SampleStayPricer:
    name = "sample"
    is_sample = True

    async def quote(self, request: PriceRequest) -> list[PriceQuote]:
        factor = _lead_time_factor(request.start_date)
        key = (request.destination.lower(), request.start_date, request.end_date)
        nightly = [
            ("Guesthouse", "Budget · breakfast included", 1600 * _jitter(*key, "budget") * factor),
            ("Boutique hotel", "Mid-range · free cancellation", 3400 * _jitter(*key, "mid") * factor),
            ("Resort", "Premium · pool and spa", 7800 * _jitter(*key, "premium") * factor),
        ]
        rooms, nights = request.rooms, request.nights
        return [
            PriceQuote(
                kind="stay",
                name=name,
                detail=f"{detail} · {rooms} room{'s' if rooms > 1 else ''} for {nights} night{'s' if nights > 1 else ''}",
                price=round(rate * rooms * nights, -1),
            )
            for name, detail, rate in nightly
        ]
