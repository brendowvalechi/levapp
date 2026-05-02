from __future__ import annotations
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ride import Ride, RideStatus
from app.models.user import User, DriverProfile, VerificationStatus
from app.models.payment import Payment, PaymentStatus


# ─── Stats ───────────────────────────────────────────────────────────────────

async def get_stats(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Rides today
    r_today = await db.execute(
        select(func.count(Ride.id)).where(
            Ride.created_at >= today_start, Ride.deleted_at.is_(None)
        )
    )
    rides_today = r_today.scalar() or 0

    # Rides this month
    r_month = await db.execute(
        select(func.count(Ride.id)).where(
            Ride.created_at >= month_start, Ride.deleted_at.is_(None)
        )
    )
    rides_month = r_month.scalar() or 0

    # GMV this month (paid payments)
    gmv_q = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0.0)).where(
            Payment.created_at >= month_start,
            Payment.status.in_([PaymentStatus.approved, PaymentStatus.in_escrow, PaymentStatus.released]),
        )
    )
    gmv_month = float(gmv_q.scalar() or 0.0)

    # Platform revenue this month (released only)
    rev_q = await db.execute(
        select(func.coalesce(func.sum(Payment.platform_fee), 0.0)).where(
            Payment.created_at >= month_start,
            Payment.status == PaymentStatus.released,
        )
    )
    revenue_month = float(rev_q.scalar() or 0.0)

    # Pending drivers
    pending_q = await db.execute(
        select(func.count(DriverProfile.id)).where(
            DriverProfile.verification_status == VerificationStatus.pending
        )
    )
    pending_drivers = pending_q.scalar() or 0

    # Active drivers (approved + is_online)
    active_q = await db.execute(
        select(func.count(DriverProfile.id)).where(
            DriverProfile.verification_status == VerificationStatus.approved,
            DriverProfile.is_online == True,
        )
    )
    active_drivers = active_q.scalar() or 0

    # Total approved drivers
    approved_q = await db.execute(
        select(func.count(DriverProfile.id)).where(
            DriverProfile.verification_status == VerificationStatus.approved
        )
    )
    total_approved_drivers = approved_q.scalar() or 0

    # Total users
    users_q = await db.execute(
        select(func.count(User.id)).where(User.deleted_at.is_(None))
    )
    total_users = users_q.scalar() or 0

    # Completed rides all-time
    completed_q = await db.execute(
        select(func.count(Ride.id)).where(
            Ride.status == RideStatus.completed, Ride.deleted_at.is_(None)
        )
    )
    rides_completed = completed_q.scalar() or 0

    # Open rides now
    open_q = await db.execute(
        select(func.count(Ride.id)).where(
            Ride.status == RideStatus.open, Ride.deleted_at.is_(None)
        )
    )
    rides_open = open_q.scalar() or 0

    return {
        "rides_today": rides_today,
        "rides_month": rides_month,
        "rides_completed": rides_completed,
        "rides_open": rides_open,
        "gmv_month": gmv_month,
        "revenue_month": revenue_month,
        "pending_drivers": pending_drivers,
        "active_drivers": active_drivers,
        "total_approved_drivers": total_approved_drivers,
        "total_users": total_users,
    }


# ─── Users ───────────────────────────────────────────────────────────────────

async def list_users(
    db: AsyncSession,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> list[User]:
    query = select(User).where(User.deleted_at.is_(None))
    if search:
        term = f"%{search.lower()}%"
        query = query.where(
            func.lower(User.name).like(term) | func.lower(User.email).like(term)
        )
    query = query.options(selectinload(User.driver_profile)).order_by(User.created_at.desc())
    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    return list(result.scalars().all())


async def suspend_user(db: AsyncSession, user_id: uuid.UUID, suspend: bool) -> User:
    result = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    user.is_active = not suspend
    await db.commit()
    await db.refresh(user)
    return user


# ─── Recent activity ─────────────────────────────────────────────────────────

async def recent_rides(db: AsyncSession, limit: int = 10) -> list[dict]:
    result = await db.execute(
        select(Ride)
        .where(Ride.deleted_at.is_(None))
        .options(selectinload(Ride.client))
        .order_by(Ride.created_at.desc())
        .limit(limit)
    )
    rides = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "origin_address": r.origin_address,
            "destination_address": r.destination_address,
            "category": r.category,
            "status": r.status,
            "distance_km": r.distance_km,
            "created_at": r.created_at.isoformat(),
            "client": {
                "id": str(r.client.id),
                "name": r.client.name,
                "email": r.client.email,
            } if r.client else None,
        }
        for r in rides
    ]
