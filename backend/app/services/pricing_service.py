import asyncio
from datetime import datetime, timezone

from app.core.logger import get_logger
from app.providers import registry
from app.schemas.pricing import PriceRequest, PriceResponse

logger = get_logger("pricing")

PROVIDER_TIMEOUT_S = 20


class PricingService:
    """Fetches exact prices for a trip from the configured providers."""

    async def price_trip(self, request: PriceRequest) -> PriceResponse:
        transport, stays = registry.transport_pricer(), registry.stay_pricer()
        now = datetime.now(timezone.utc)

        if transport is None and stays is None:
            return PriceResponse(
                status="unavailable",
                source="none",
                message="Exact prices aren't connected yet. Your plan's estimates are still a good guide.",
                fetched_at=now,
            )

        async def run(pricer):
            if pricer is None:
                return []
            return await asyncio.wait_for(pricer.quote(request), PROVIDER_TIMEOUT_S)

        try:
            transport_quotes, stay_quotes = await asyncio.gather(run(transport), run(stays))
        except Exception as exc:  # provider down, timeout, bad credentials…
            logger.warning("Pricing provider failed: %s", exc)
            return PriceResponse(
                status="unavailable",
                source=(transport or stays).name,
                message="We couldn't reach the pricing service. Try again in a moment.",
                fetched_at=now,
            )

        message = None
        if transport is not None and not request.origin:
            message = "Add your starting city to view transport prices."

        return PriceResponse(
            status="ok",
            source=(transport or stays).name,
            is_sample=any(p is not None and p.is_sample for p in (transport, stays)),
            transport=sorted(transport_quotes, key=lambda q: q.price),
            stays=sorted(stay_quotes, key=lambda q: q.price),
            message=message,
            fetched_at=now,
        )
