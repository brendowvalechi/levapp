import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.user import User, DriverProfile, Vehicle, VerificationStatus
from app.schemas.documents import DocumentsUpdateRequest, AdminVerifyRequest


async def update_driver_documents(
    db: AsyncSession, user: User, data: DocumentsUpdateRequest
) -> DriverProfile:
    profile = user.driver_profile
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Perfil de motorista não encontrado",
        )

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(profile, field, value)

    # Reset to pending whenever new docs are uploaded (re-verification needed)
    if any(v for v in data.model_dump(exclude_none=True).values()):
        if profile.verification_status == VerificationStatus.rejected:
            profile.verification_status = VerificationStatus.pending
            profile.rejection_reason = None

    await db.commit()
    await db.refresh(profile)
    return profile


async def update_vehicle_crlv(
    db: AsyncSession, user: User, vehicle_id: str, crlv_url: str
) -> Vehicle:
    if not user.driver_profile:
        raise HTTPException(status_code=404, detail="Perfil de motorista não encontrado")

    result = await db.execute(
        select(Vehicle).where(
            Vehicle.id == uuid.UUID(vehicle_id),
            Vehicle.driver_id == user.driver_profile.id,
        )
    )
    vehicle = result.scalar_one_or_none()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")

    vehicle.crlv_url = crlv_url
    await db.commit()
    await db.refresh(vehicle)
    return vehicle


async def get_verification_status(user: User) -> dict:
    profile = user.driver_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil de motorista não encontrado")

    missing = []
    if not profile.cnh_front_url:
        missing.append("CNH frente")
    if not profile.cnh_back_url:
        missing.append("CNH verso")
    if not profile.selfie_url:
        missing.append("Selfie com documento")
    if not profile.cnh_number:
        missing.append("Número da CNH")

    return {
        "status": profile.verification_status,
        "rejection_reason": profile.rejection_reason,
        "missing_documents": missing,
        "is_complete": len(missing) == 0,
        "cnh_number": profile.cnh_number,
        "has_cnh_front": bool(profile.cnh_front_url),
        "has_cnh_back": bool(profile.cnh_back_url),
        "has_selfie": bool(profile.selfie_url),
    }


# ─── Admin ───────────────────────────────────────────────────────────────────

async def list_pending_drivers(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(DriverProfile)
        .options(selectinload(DriverProfile.user), selectinload(DriverProfile.vehicles))
        .where(DriverProfile.verification_status == VerificationStatus.pending)
        .order_by(DriverProfile.created_at.asc())
    )
    profiles = result.scalars().all()
    return [_profile_to_dict(p) for p in profiles]


async def list_all_drivers(
    db: AsyncSession, status_filter: VerificationStatus | None = None
) -> list[dict]:
    query = select(DriverProfile).options(
        selectinload(DriverProfile.user), selectinload(DriverProfile.vehicles)
    )
    if status_filter:
        query = query.where(DriverProfile.verification_status == status_filter)
    query = query.order_by(DriverProfile.created_at.desc())
    result = await db.execute(query)
    profiles = result.scalars().all()
    return [_profile_to_dict(p) for p in profiles]


async def verify_driver(
    db: AsyncSession, driver_profile_id: str, data: AdminVerifyRequest
) -> dict:
    result = await db.execute(
        select(DriverProfile)
        .options(selectinload(DriverProfile.user), selectinload(DriverProfile.vehicles))
        .where(DriverProfile.id == uuid.UUID(driver_profile_id))
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Perfil de motorista não encontrado")

    profile.verification_status = data.status
    profile.rejection_reason = data.rejection_reason

    await db.commit()

    # Re-query to get fresh relationships after commit (refresh() expira lazy attrs)
    refreshed = await db.execute(
        select(DriverProfile)
        .options(selectinload(DriverProfile.user), selectinload(DriverProfile.vehicles))
        .where(DriverProfile.id == uuid.UUID(driver_profile_id))
    )
    profile = refreshed.scalar_one()
    return _profile_to_dict(profile)


def _profile_to_dict(p: DriverProfile) -> dict:
    return {
        "id": str(p.id),
        "user_id": str(p.user_id),
        "user": {
            "id": str(p.user.id),
            "name": p.user.name,
            "email": p.user.email,
            "phone": p.user.phone,
        },
        "cnh_number": p.cnh_number,
        "cnh_front_url": p.cnh_front_url,
        "cnh_back_url": p.cnh_back_url,
        "selfie_url": p.selfie_url,
        "verification_status": p.verification_status,
        "rejection_reason": p.rejection_reason,
        "rating_avg": p.rating_avg,
        "rating_count": p.rating_count,
        "total_rides": p.total_rides,
        "total_vehicles": len(p.vehicles),
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }
