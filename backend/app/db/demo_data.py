"""
The demo: an account with saved trips, and prompts to type that show each feature.
Used by `python -m app.cli seed-demo`, `python -m app.cli demo-prompts` (which run.sh
prints) and DEMO.md. Dates roll forward to their next occurrence, so they stay in the future.

In mock mode (no AI) every plan is predictable, so the follow-up commands below are known
to work on the plan each prompt makes.
"""

from datetime import date, timedelta

# A local test account: only for this computer's demo database.
DEMO_ACCOUNT = {"name": "Demo Traveller", "email": "demo@tripmate.local", "password": "trip-demo-2026"}


def next_date(month: int, day: int, today: date | None = None) -> date:
    """The next `day month` at least a week away, so it's always in the future."""
    today = today or date.today()
    candidate = date(today.year, month, day)
    return candidate if candidate >= today + timedelta(days=7) else date(today.year + 1, month, day)


def _dates(month: int, day: int, days: int) -> tuple[date, date]:
    start = next_date(month, day)
    return start, start + timedelta(days=days - 1)


# (prompt, (month, day) of the start, trip length, what to notice, things to try next)
PROMPTS = [
    (
        "Christmas in Goa, 24–27 Dec, for 2 people under ₹45,000, beaches and nightlife",
        (12, 24), 4,
        "Festival pricing: rooms cost about 45% more over Christmas. Open Where the money goes › How we estimated this.",
        ["drop Anjuna Flea Market", "swap Palolem Beach for Dudhsagar Falls trip"],
    ),
    (
        "4 days in Goa 13–16 Jul for 2 people, beaches and food",
        (7, 13), 4,
        "Same trip in the monsoon: stays cost less than half of Christmas week. Compare the two totals.",
        ["drop Fort Aguada", "swap Palolem Beach for the Basilica of Bom Jesus"],
    ),
    (
        "5 days in Manali 10–14 Oct for me and my 2 friends, trekking and mountains",
        (10, 10), 5,
        "“Me and my 2 friends” reads as 3 people: one room plus an extra bed, not two rooms.",
        ["swap the hot springs for Mall Road", "drop Solang Valley"],
    ),
    (
        "Jaipur 22–24 Jan with my wife, history and shopping",
        (1, 22), 3,
        "Two weekend nights push room prices up; “with my wife” is 2 people.",
        ["swap the bazaars for the Hawa Mahal", "drop the City Palace"],
    ),
    (
        "6 days in Andaman 9–14 Mar for 2 people, beaches and adventure",
        (3, 9), 6,
        "No train or road to the islands, so getting there is flights only.",
        ["drop the scuba dive", "swap Ross Island for Radhanagar Beach, Havelock"],
    ),
    (
        "3 days in Hampi 18–20 Jan for 2 people, history and photography",
        (1, 18), 3,
        "A small-budget trip; places to eat come from TripMate's guide.",
        ["drop the coracle ride", "drop Lotus Mahal"],
    ),
]

# Prompts that show the AI at work in real-model mode (rules alone get these less right).
AI_PROMPTS = [
    ("weekend in hampi with my wife, love history and photography, budget 15k", "“weekend” → 2 days, “15k” → ₹15,000, chosen and ordered by gemma4"),
    ("write me a poem about cats", "tev1 flags that this isn't a trip request"),
]
AI_REVISIONS = ["make day 2 more relaxed", "swap the market for something outdoors"]
SEARCHES = [("somewhere with sea and sand", "Goa first (by meaning with AI; by words without, try “goa”)"), ("old forts and palaces", "Jaipur first")]

# Saved in the demo account by seed-demo.
SAVED = [0, 2, 5]


def prompt_dates(index: int) -> tuple[date, date]:
    _, (month, day), days, _, _ = PROMPTS[index]
    return _dates(month, day, days)
