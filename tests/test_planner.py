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
