from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.schemas.trip import TripRequest, TripResponse
from app.services.trip_service import TripService

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Multi-agent AI travel planner.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict this in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

trip_service = TripService()


@app.get("/health")
async def health():
    return {"status": "ok", "service": settings.app_name}


@app.post("/api/trips/plan", response_model=TripResponse)
async def plan_trip(request: TripRequest):
    result = await trip_service.plan_trip(request.query)

    return TripResponse(
        destination=result.get("destination", ""),
        days=result.get("days", 0),
        travelers=result.get("travelers", 1),
        budget=result.get("budget", 0),
        total_cost=result.get("total_cost", 0),
        itinerary=result.get("itinerary", []),
        issues=result.get("issues", []),
        completed_agents=result.get("completed_agents", []),
        final_response=result.get("final_response", ""),
    )
