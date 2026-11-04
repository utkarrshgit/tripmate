"""/api/v1/admin/users: account management for admins."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import DB, admin
from app.schemas.accounts import AdminUserOut, AdminUserPage, AdminUserPatch
from app.services import admin_service

router = APIRouter(prefix="/admin/users", tags=["admin"], dependencies=[Depends(admin)])


@router.get("", response_model=AdminUserPage)
async def list_users(
    q: str | None = None,
    role: Literal["user", "admin"] | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = DB,
):
    return await admin_service.list_users(db, q, role, page, per_page)


@router.get("/{user_id}", response_model=AdminUserOut)
async def get_user(user_id: uuid.UUID, db: AsyncSession = DB):
    return await admin_service.get_user(db, user_id)


@router.patch("/{user_id}", response_model=AdminUserOut)
async def update_user(user_id: uuid.UUID, body: AdminUserPatch, db: AsyncSession = DB):
    """Changes the role, or turns the account off (ending its sessions) or back on."""
    return await admin_service.update_user(db, user_id, body.role, body.disabled)


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: uuid.UUID, db: AsyncSession = DB):
    await admin_service.delete_user(db, user_id)
    return Response(status_code=204)
