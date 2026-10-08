from typing import Any, TypedDict


class AgentState(TypedDict, total=False):
    user_query: str
    destination: str
    days: int
    budget: float
    interests: list[str]
    travelers: int
    start_date: str
    end_date: str

    destination_info: dict[str, Any]
    transport_options: list[dict[str, Any]]
    hotel_options: list[dict[str, Any]]
    activities: list[dict[str, Any]]
    food_options: list[dict[str, Any]]

    estimated_transport_cost: float
    estimated_hotel_cost: float
    estimated_activity_cost: float
    estimated_food_cost: float
    total_cost: float

    itinerary: list[dict[str, Any]]
    issues: list[str]
    completed_agents: list[str]
    final_response: str
