import pytest

from app.agents.planner import PlannerAgent


@pytest.mark.asyncio
async def test_planner_extracts_basic_trip():
    state = {
        "user_query": "Plan a 5 day trip to Manali for 3 people under ₹30000",
        "completed_agents": [],
    }

    result = await PlannerAgent().run(state)

    assert result["days"] == 5
    assert result["travelers"] == 3
    assert result["budget"] == 30000
    assert "manali" in result["destination"].lower()


@pytest.mark.parametrize(
    "query, expected",
    [
        ("Plan a 5 day trip to Manali 12-16 Dec under ₹30000 for 3 people with nature", "Manali"),
        ("Plan a 5 day trip to Manali for 3 people under ₹30000", "Manali"),
        ("Plan a 4 day trip to Goa under ₹25000 for 2 people with beaches", "Goa"),
        ("Visit Goa", "Goa"),
        ("Plan a trip to Goa", "Goa"),
        ("A weekend in Jaipur", "Jaipur"),
        ("Plan a trip to New Delhi from 12 Dec", "New Delhi"),
        ("Trip to Leh Ladakh, with friends", "Leh Ladakh"),
        ("Plan a trip in December to Goa", "Goa"),
        ("Goa trip on Dec 12", "Unknown destination"),
        ("Plan something fun", "Unknown destination"),
    ],
)
def test_destination_extraction(query, expected):
    assert PlannerAgent()._extract_destination(query) == expected
