import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.user import User, DriverProfile, Vehicle
from app.schemas.user import UserUpdateRequest, DriverProfileUpdateRequest, VehicleCreateRequest


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User:
    result = await db.execute(
        select(User)
        .options(selectinload(User.driver_profile).selectinload(DriverProfile.vehicles))
        .where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    return user


async def update_user(db: AsyncSession, user: User, data: UserUpdateRequest) -> User:
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


async def update_driver_profile(
    db: AsyncSession, user: User, data: DriverProfileUpdateRequest
) -> DriverProfile:
    if not user.driver_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil de motorista não encontrado",
        )
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user.driver_profile, field, value)
    await db.commit()
    await db.refresh(user.driver_profile)
    return user.driver_profile


async def add_vehicle(
    db: AsyncSession, user: User, data: VehicleCreateRequest
) -> Vehicle:
    if not user.driver_profile:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Crie um perfil de motorista antes de cadastrar veículos",
        )

    # Check duplicate plate
    existing = await db.execute(select(Vehicle).where(Vehicle.plate == data.plate.upper()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Placa já cadastrada")

    vehicle = Vehicle(
        driver_id=user.driver_profile.id,
        **{**data.model_dump(), "plate": data.plate.upper()},
    )
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    return vehicle


async def list_vehicles(db: AsyncSession, user: User) -> list[Vehicle]:
    if not user.driver_profile:
        return []
    result = await db.execute(
        select(Vehicle).where(
            Vehicle.driver_id == user.driver_profile.id,
            Vehicle.is_active == True,
        )
    )
    return list(result.scalars().all())
