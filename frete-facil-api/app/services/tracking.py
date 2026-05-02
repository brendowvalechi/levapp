from __future__ import annotations
import uuid
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.models.ride import Ride, Offer, RideStatus, OfferStatus
from app.models.user import User

_LOCATION_TTL = 120  # seconds — location expires if driver goes silent


def _tracking_key(ride_id: str) -> str:
    return f"tracking:{ride_id}"


async def save_location(ride_id: str, driver_id: str, lat: float, lng: float) -> dict:
    redis = await get_redis()
    payload = {
        "lat": lat,
        "lng": lng,
        "driver_id": driver_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await redis.setex(_tracking_key(ride_id), _LOCATION_TTL, json.dumps(payload))
    return payload


async def get_location(ride_id: str) -> Optional[dict]:
    redis = await get_redis()
    raw = await redis.get(_tracking_key(ride_id))
    if not raw:
        return None
    return json.loads(raw)


async def clear_location(ride_id: str) -> None:
    redis = await get_redis()
    await redis.delete(_tracking_key(ride_id))


async def resolve_participant(
    db: AsyncSession, user: User, ride_id: uuid.UUID
) -> tuple[Ride, bool]:
    """
    Returns (ride, is_driver).
    Raises 403/404 if user is not a participant of this matched/in_progress ride.
    """
    result = await db.execute(
        select(Ride).where(Ride.id == ride_id, Ride.deleted_at.is_(None))
    )
    ride = result.scalar_one_or_none()
    if not ride:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corrida não encontrada")

    if ride.status not in (RideStatus.matched, RideStatus.in_progress, RideStatus.completed):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Rastreamento disponível apenas para corridas em andamento ou aceitas",
        )

    is_client = ride.client_id == user.id

    is_driver = False
    if ride.accepted_offer_id:
        offer_res = await db.execute(
            select(Offer).where(Offer.id == ride.accepted_offer_id)
        )
        offer = offer_res.scalar_one_or_none()
        is_driver = offer is not None and offer.driver_id == user.id

    if not is_client and not is_driver:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")

    return ride, is_driver


_VALID_TRANSITIONS: dict[RideStatus, list[RideStatus]] = {
    RideStatus.matched: [RideStatus.in_progress],
    RideStatus.in_progress: [RideStatus.completed],
}


async def update_ride_status(
    db: AsyncSession, driver: User, ride: Ride, new_status: RideStatus
) -> Ride:
    allowed = _VALID_TRANSITIONS.get(ride.status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Transição inválida: {ride.status} → {new_status}",
        )
    ride.status = new_status
    if new_status == RideStatus.completed:
        await clear_location(str(ride.id))
    await db.commit()
    await db.refresh(ride)

    # Push notifications for status changes
    from app.tasks.notifications import send_push_to_user
    if new_status == RideStatus.in_progress:
        send_push_to_user.delay(
            str(ride.client_id),
            "Levagem iniciada!",
            "O motorista está a caminho para buscar sua carga.",
            {"type": "ride_started", "ride_id": str(ride.id)},
        )
    elif new_status == RideStatus.completed:
        send_push_to_user.delay(
            str(ride.client_id),
            "Levagem concluída!",
            "Sua levagem foi entregue. Avalie o motorista.",
            {"type": "ride_completed", "ride_id": str(ride.id)},
        )

    return ride
