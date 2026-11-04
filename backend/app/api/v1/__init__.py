from fastapi import APIRouter

from app.api.v1 import admin, auth, trips, users

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router)
router.include_router(users.router)
router.include_router(admin.router)
router.include_router(trips.router)
router.include_router(trips.shared)
