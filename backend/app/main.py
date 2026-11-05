import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import router as api_v1
from app.core.config import settings
from app.core.errors import CatchAllMiddleware, install_error_handlers
from app.services.health_service import check_health
from app.schemas.pricing import PriceRequest, PriceResponse
from app.schemas.trip import TripRequest, TripResponse
from app.services.pricing_service import PricingService
from app.llm.gateway import warm_up
from app.services.trip_service import trip_service

@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Load the general model in the background, so the first plan isn't slow and startup isn't blocked.
    warming = asyncio.create_task(warm_up())
    yield
    warming.cancel()


app = FastAPI(
    lifespan=lifespan,
    title=settings.app_name,
    version=settings.app_version,
    description="Multi-agent AI travel planner.",
)

# Added before CORS, so CORS wraps it and even error responses carry CORS headers.
app.add_middleware(CatchAllMiddleware)

# Only the website may call the API with cookies (CORS_ORIGINS in .env; run.sh sets it to the website's port).
# A wildcard origin can't be used with cookies: browsers refuse to send them.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

install_error_handlers(app)
app.include_router(api_v1)

pricing_service = PricingService()


@app.get("/health")
async def health():
    """Always answers 200 while the API runs; `status` is "degraded" when the database or a model is missing."""
    return await check_health()


@app.post("/api/trips/plan", response_model=TripResponse)
async def plan_trip(request: TripRequest):
    """Plans a trip in one response. /api/v1/plans/stream does the same with live progress."""
    return await trip_service.plan_trip(request.query, start_date=request.start_date, end_date=request.end_date)


@app.post("/api/trips/price", response_model=PriceResponse)
async def price_trip(request: PriceRequest):
    """Exact prices for a planned trip. Plans themselves only carry estimates."""
    return await pricing_service.price_trip(request)
