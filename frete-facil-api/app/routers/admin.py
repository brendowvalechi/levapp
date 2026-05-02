import uuid
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated, Optional

from app.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User, VerificationStatus
from app.schemas.documents import AdminVerifyRequest, DriverVerificationListItem
from app.schemas.user import DriverProfileResponse, UserResponse
from app.services import documents as doc_service
from app.services import admin as admin_svc

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _require_admin(current_user: User = Depends(require_admin)) -> User:
    return current_user


class SuspendRequest(BaseModel):
    suspend: bool


# ─── Stats ───────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    return await admin_svc.get_stats(db)


# ─── Users ───────────────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserResponse])
async def list_users(
    search: Annotated[Optional[str], Query()] = None,
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    return await admin_svc.list_users(db, search=search, page=page, page_size=page_size)


@router.patch("/users/{user_id}/suspend", response_model=UserResponse)
async def suspend_user(
    user_id: uuid.UUID,
    body: SuspendRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    return await admin_svc.suspend_user(db, user_id, body.suspend)


# ─── Recent activity ─────────────────────────────────────────────────────────

@router.get("/recent-rides")
async def recent_rides(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    return await admin_svc.recent_rides(db)


# ─── Drivers ─────────────────────────────────────────────────────────────────

@router.get("/drivers", response_model=list[DriverVerificationListItem])
async def list_drivers(
    status: Annotated[VerificationStatus | None, Query()] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    return await doc_service.list_all_drivers(db, status_filter=status)


@router.get("/drivers/pending", response_model=list[DriverVerificationListItem])
async def list_pending_drivers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    return await doc_service.list_pending_drivers(db)


@router.patch("/drivers/{driver_profile_id}/verify", response_model=DriverVerificationListItem)
async def verify_driver(
    driver_profile_id: uuid.UUID,
    data: AdminVerifyRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(_require_admin),
):
    return await doc_service.verify_driver(db, str(driver_profile_id), data)
