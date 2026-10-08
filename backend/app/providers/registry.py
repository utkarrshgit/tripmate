"""
Picks pricing providers from settings (PRICING_PROVIDER in .env).

  none    — exact pricing is switched off; the API says so instead of guessing
  sample  — development-only generated prices (see providers/sample.py)

To add a real provider (e.g. Travelpayouts for transport, LiteAPI for stays),
implement TransportPricer / StayPricer in a new module and register it below.
"""

from app.core.config import settings
from app.providers.base import StayPricer, TransportPricer
from app.providers.sample import SampleStayPricer, SampleTransportPricer

_TRANSPORT: dict[str, type] = {"sample": SampleTransportPricer}
_STAYS: dict[str, type] = {"sample": SampleStayPricer}


def transport_pricer() -> TransportPricer | None:
    cls = _TRANSPORT.get(settings.pricing_provider)
    return cls() if cls else None


def stay_pricer() -> StayPricer | None:
    cls = _STAYS.get(settings.pricing_provider)
    return cls() if cls else None
