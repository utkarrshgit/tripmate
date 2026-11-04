"""
Estimated prices: per-destination base rates (typical 2026 rupees), adjusted for the travel
dates and the group. Every adjustment is explained in plain words, so a plan can say why.

The base rates are rough averages from public fares and listings, not live prices:
  rail        return train or bus per person, from the nearest big city (0 = no rail or road option)
  flight      return economy flight per person, from the nearest big city
  stay        one budget room a night (2 people, or 3 with an extra bed), and a comfort room
  local       local travel per person a day (autos, cabs, scooters, ferries)
  food        meals per person a day
Calendar adjustments go up or down from there:
  peak season (the destination's best months)   rooms +20%, flights +15%
  off season (the rest)                          rooms -20%, flights -10%
  Christmas to New Year (20 Dec – 2 Jan)        rooms +45%, flights +30%
  Diwali and Holi weeks                          rooms +25%, flights +25%
  Friday and Saturday nights                     rooms +15%
  booked under 2 weeks ahead                     flights +30% (under a month: +15%; 2+ months: -5%)
  4 or more people                               local travel -20% each (shared cabs)
"""

from dataclasses import dataclass, field
from datetime import date, timedelta

BASE = {
    #             rail   flight  stay  comfort local food  best months
    "manali":     (3000,  9000, 1800, 3500,   600, 700, {3, 4, 5, 6, 10, 11, 12}),
    "goa":        (2500,  7000, 2200, 4500,   700, 900, {11, 12, 1, 2, 3}),
    "jaipur":     (1500,  6000, 1800, 3800,   500, 600, {10, 11, 12, 1, 2, 3}),
    "kerala":     (3500,  8000, 2000, 4200,   800, 700, {9, 10, 11, 12, 1, 2, 3}),
    "ladakh":     (6000, 11000, 2200, 4000,  1200, 800, {5, 6, 7, 8, 9}),
    "rishikesh":  (1200,  7000, 1200, 2800,   300, 500, {2, 3, 4, 5, 9, 10, 11}),
    "udaipur":    (2000,  7500, 2000, 4500,   500, 700, {9, 10, 11, 12, 1, 2, 3}),
    "varanasi":   (2000,  7000, 1300, 3000,   300, 450, {10, 11, 12, 1, 2, 3}),
    "andaman":    (0,    12000, 2500, 5500,   900, 1000, {11, 12, 1, 2, 3, 4, 5}),
    "darjeeling": (3000,  8500, 1800, 3500,   600, 650, {3, 4, 5, 10, 11}),
    "coorg":      (1400,  6500, 2200, 4500,   800, 750, {10, 11, 12, 1, 2, 3}),
    "hampi":      (1500,  7000, 1200, 2500,   350, 450, {10, 11, 12, 1, 2}),
}
GENERIC = (2500, 7500, 2000, 4000, 600, 650, set())

# Festival weeks that move prices across India (start, end inclusive).
FESTIVALS = [
    ("Diwali week", date(2026, 11, 5), date(2026, 11, 12)),
    ("Holi week", date(2027, 3, 19), date(2027, 3, 24)),
    ("Diwali week", date(2027, 10, 26), date(2027, 11, 2)),
    ("Holi week", date(2026, 3, 1), date(2026, 3, 6)),
]
MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def _rates(destination: str) -> tuple:
    return BASE.get((destination or "").strip().lower(), GENERIC)


def _christmas(d: date) -> bool:
    return (d.month == 12 and d.day >= 20) or (d.month == 1 and d.day <= 2)


def _festival(d: date) -> str | None:
    if _christmas(d):
        return "Christmas and New Year"
    return next((name for name, start, end in FESTIVALS if start <= d <= end), None)


@dataclass
class Estimate:
    getting_there: list[dict]  # [{mode, description, estimated_cost}] for the group, return
    local_travel: float  # the group, the whole trip
    stays: list[dict]  # [{name, category, nightly_rate, rooms, estimated_total}]
    food_per_person_day: float
    notes: list[str] = field(default_factory=list)  # why the numbers moved, in plain words


def estimate(destination: str, days: int, travelers: int, start: date | None = None, end: date | None = None, today: date | None = None) -> Estimate:
    rail, flight, stay, comfort, local, food, best = _rates(destination)
    today = today or date.today()
    days, travelers = max(days, 1), max(travelers, 1)
    nights = max(days - 1, 1)
    # Two to a room; an odd one out takes an extra bed in a room (triple sharing), not a room of their own.
    rooms = max(travelers // 2, 1)
    place = destination or "the destination"
    notes: list[str] = []

    # Flights: season of the start date, festivals and how far ahead.
    flight_factor = 1.0
    nightly_factors = [1.0] * nights
    if start:
        month = start.month
        if best and month in best:
            flight_factor *= 1.15
            nightly_factors = [f * 1.2 for f in nightly_factors]
            notes.append(f"{MONTHS[month]} is peak season in {place}: rooms about 20% more, flights about 15% more.")
        elif best:
            flight_factor *= 0.9
            nightly_factors = [f * 0.8 for f in nightly_factors]
            notes.append(f"{MONTHS[month]} is off season in {place}: rooms about 20% less, flights about 10% less.")
        festival = _festival(start)
        if festival:
            flight_factor *= 1.25 if festival != "Christmas and New Year" else 1.3
        ahead = (start - today).days
        if 0 <= ahead < 14:
            flight_factor *= 1.3
            notes.append(f"Booking {ahead} day{'s' if ahead != 1 else ''} ahead: fares about 30% more than usual.")
        elif ahead < 30:
            flight_factor *= 1.15
            notes.append("Booking under a month ahead: fares about 15% more.")
        elif ahead >= 60:
            flight_factor *= 0.95
            notes.append("Booking two months or more ahead: fares about 5% less.")
        # Each night: festivals and weekends.
        seen = set()
        for n in range(nights):
            night = start + timedelta(days=n)
            if (festival := _festival(night)) is not None:
                nightly_factors[n] *= 1.45 if festival == "Christmas and New Year" else 1.25
                if festival not in seen:
                    seen.add(festival)
                    pct = 45 if festival == "Christmas and New Year" else 25
                    notes.append(f"{festival}: rooms about {pct}% more those nights, and flights more too.")
            if night.weekday() in (4, 5):  # Friday and Saturday nights
                nightly_factors[n] *= 1.15
        weekend_nights = sum(1 for n in range(nights) if (start + timedelta(days=n)).weekday() in (4, 5))
        if weekend_nights:
            notes.append(f"{weekend_nights} Friday or Saturday night{'s' if weekend_nights > 1 else ''}: rooms about 15% more.")
    else:
        notes.append("Prices assume an ordinary week. Add dates for estimates that follow the season.")

    getting_there = []
    if rail:
        getting_there.append({"mode": "Train or bus", "description": f"Return trip to {place} by train or bus" if destination else "Return trip by train or bus", "estimated_cost": round(rail * travelers, -1)})
    getting_there.append({"mode": "Flight", "description": "Return economy flight", "estimated_cost": round(flight * flight_factor * travelers, -1)})
    if not rail:
        notes.append(f"There's no train or road route to {place}, so the estimate uses flights.")

    local_each = local * (0.8 if travelers >= 4 else 1.0)
    if travelers >= 4:
        notes.append("With 4 or more people, shared cabs bring local travel down about 20% each.")
    # The extra bed costs about a quarter of the room rate.
    extra_beds = 0.25 if travelers % 2 == 1 and travelers > 1 else 0

    def stay_total(rate: float) -> float:
        return round(sum(rate * f for f in nightly_factors) * (rooms + extra_beds), -1)

    stays = [
        {"name": "Budget stay", "category": "budget", "nightly_rate": round(stay * sum(nightly_factors) / nights, -1), "rooms": rooms, "estimated_total": stay_total(stay)},
        {"name": "Comfort stay", "category": "mid-range", "nightly_rate": round(comfort * sum(nightly_factors) / nights, -1), "rooms": rooms, "estimated_total": stay_total(comfort)},
    ]
    return Estimate(getting_there, round(local_each * travelers * days, -1), stays, food, notes)
