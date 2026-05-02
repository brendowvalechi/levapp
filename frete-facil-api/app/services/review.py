from __future__ import annotations
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.review import Review
from app.models.ride import Ride, Offer, RideStatus
from app.models.user import User, DriverProfile
from app.schemas.review import ReviewCreateRequest


async def _get_completed_ride(db: AsyncSession, ride_id: uuid.UUID) -> Ride:
    result = await db.execute(
        select(Ride).where(Ride.id == ride_id, Ride.deleted_at.is_(None))
    )
    ride = result.scalar_one_or_none()
    if not ride:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corrida não encontrada")
    if ride.status != RideStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Avaliações só são permitidas após a corrida ser concluída",
        )
    return ride


async def _get_driver_id_for_ride(db: AsyncSession, ride: Ride) -> uuid.UUID:
    if not ride.accepted_offer_id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Corrida sem motorista")
    result = await db.execute(select(Offer).where(Offer.id == ride.accepted_offer_id))
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Oferta não encontrada")
    return offer.driver_id


async def create_review(
    db: AsyncSession, reviewer: User, ride_id: uuid.UUID, data: ReviewCreateRequest
) -> Review:
    ride = await _get_completed_ride(db, ride_id)

    # Determine reviewed user
    is_client = ride.client_id == reviewer.id
    if is_client:
        reviewed_id = await _get_driver_id_for_ride(db, ride)
    else:
        # Driver reviewing client — check they were the driver
        driver_id = await _get_driver_id_for_ride(db, ride)
        if driver_id != reviewer.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
        reviewed_id = ride.client_id

    # Check duplicate
    existing = await db.execute(
        select(Review).where(Review.ride_id == ride_id, Review.reviewer_id == reviewer.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Você já avaliou esta corrida",
        )

    review = Review(
        ride_id=ride_id,
        reviewer_id=reviewer.id,
        reviewed_id=reviewed_id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    await db.flush()

    # Update driver rating if client is reviewing driver
    if is_client:
        await _update_driver_rating(db, reviewed_id)

    await db.commit()
    await db.refresh(review)
    return review


async def _update_driver_rating(db: AsyncSession, driver_user_id: uuid.UUID) -> None:
    result = await db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.reviewed_id == driver_user_id
        )
    )
    avg, count = result.one()
    dp_result = await db.execute(
        select(DriverProfile).where(DriverProfile.user_id == driver_user_id)
    )
    dp = dp_result.scalar_one_or_none()
    if dp:
        dp.rating_avg = round(float(avg or 0), 2)
        dp.rating_count = count or 0


async def get_ride_review(
    db: AsyncSession, user: User, ride_id: uuid.UUID
) -> list[Review]:
    ride = await _get_completed_ride(db, ride_id)
    # Participant check
    driver_id = await _get_driver_id_for_ride(db, ride)
    if user.id not in (ride.client_id, driver_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")

    result = await db.execute(select(Review).where(Review.ride_id == ride_id))
    return list(result.scalars().all())


async def get_driver_rating(db: AsyncSession, driver_user_id: uuid.UUID) -> dict:
    dp_result = await db.execute(
        select(DriverProfile).where(DriverProfile.user_id == driver_user_id)
    )
    dp = dp_result.scalar_one_or_none()
    if not dp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil de motorista não encontrado")
    return {
        "driver_id": driver_user_id,
        "rating_avg": dp.rating_avg,
        "rating_count": dp.rating_count,
    }


async def list_driver_reviews(
    db: AsyncSession, driver_user_id: uuid.UUID, limit: int = 20
) -> list[Review]:
    result = await db.execute(
        select(Review)
        .where(Review.reviewed_id == driver_user_id)
        .order_by(Review.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
