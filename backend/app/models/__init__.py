"""Every table, imported here so Alembic and the app see the full schema."""

from app.models.accounts import AuthCode, LoginAttempt, Session, User
from app.models.catalog import Destination, Interest, Place, destination_interests
from app.models.runs import AgentRun, LlmCall
from app.models.trips import ItineraryItem, PlanVersion, PriceQuote, Trip, TripShare, trip_interests

__all__ = [
    "AgentRun",
    "AuthCode",
    "Destination",
    "Interest",
    "ItineraryItem",
    "LlmCall",
    "LoginAttempt",
    "Place",
    "PlanVersion",
    "PriceQuote",
    "Session",
    "Trip",
    "TripShare",
    "User",
    "destination_interests",
    "trip_interests",
]
