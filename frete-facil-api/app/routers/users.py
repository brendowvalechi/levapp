from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user, require_driver
from app.models.user import User
from app.schemas.user import (
    UserWithProfileResponse, UserUpdateRequest,
    DriverProfileResponse, DriverProfileUpdateRequest,
    VehicleCreateRequest, VehicleResponse,
)
from app.services import user as user_service

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me", response_model=UserWithProfileResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.get_user_by_id(db, current_user.id)


@router.patch("/me", response_model=UserWithProfileResponse)
async def update_me(
    data: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.update_user(db, current_user, data)


@router.patch("/me/driver-profile", response_model=DriverProfileResponse)
async def update_driver_profile(
    data: DriverProfileUpdateRequest,
    current_user: User = Depends(require_driver),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.update_driver_profile(db, current_user, data)


@router.post("/me/vehicles", response_model=VehicleResponse, status_code=201)
async def add_vehicle(
    data: VehicleCreateRequest,
    current_user: User = Depends(require_driver),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.add_vehicle(db, current_user, data)


@router.get("/me/vehicles", response_model=list[VehicleResponse])
async def list_vehicles(
    current_user: User = Depends(require_driver),
    db: AsyncSession = Depends(get_db),
):
    return await user_service.list_vehicles(db, current_user)
