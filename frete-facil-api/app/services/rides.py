from __future__ import annotations
import uuid
import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ride import Ride, Offer, RideStatus, OfferStatus, RideCategory
from app.models.user import User, UserRole, VerificationStatus
from app.schemas.ride import RideCreateRequest, OfferCreateRequest
from app.core.redis import get_redis


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


# ─── Ride CRUD ────────────────────────────────────────────────────────────────

async def create_ride(db: AsyncSession, client: User, data: RideCreateRequest) -> Ride:
    distance_km = _haversine_km(data.origin_lat, data.origin_lng, data.destination_lat, data.destination_lng)
    ride = Ride(
        client_id=client.id,
        origin_address=data.origin_address,
        origin_lat=data.origin_lat,
        origin_lng=data.origin_lng,
        destination_address=data.destination_address,
        destination_lat=data.destination_lat,
        destination_lng=data.destination_lng,
        description=data.description,
        category=data.category,
        vehicle_type_preference=data.vehicle_type_preference.value if data.vehicle_type_preference else None,
        estimated_weight_kg=data.estimated_weight_kg,
        photos=data.photos,
        scheduled_at=data.scheduled_at,
        distance_km=round(distance_km, 2),
    )
    db.add(ride)
    await db.commit()
    await db.refresh(ride)
    return ride


async def list_client_rides(
    db: AsyncSession,
    client: User,
    status_filter: Optional[RideStatus] = None,
) -> list[Ride]:
    q = (
        select(Ride)
        .where(Ride.client_id == client.id, Ride.deleted_at.is_(None))
        .order_by(Ride.created_at.desc())
    )
    if status_filter:
        q = q.where(Ride.status == status_filter)
    result = await db.execute(q)
    return list(result.scalars().all())


async def list_open_rides(
    db: AsyncSession,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 30.0,
) -> list[Ride]:
    """Open rides visible to drivers. Optionally filtered by proximity."""
    q = (
        select(Ride)
        .where(Ride.status == RideStatus.open, Ride.deleted_at.is_(None))
        .order_by(Ride.created_at.desc())
        .limit(50)
    )
    result = await db.execute(q)
    rides = list(result.scalars().all())

    if lat is not None and lng is not None:
        rides = [
            r for r in rides
            if _haversine_km(lat, lng, r.origin_lat, r.origin_lng) <= radius_km
        ]
    return rides


async def get_ride(db: AsyncSession, ride_id: uuid.UUID) -> Ride:
    result = await db.execute(
        select(Ride)
        .options(selectinload(Ride.offers).selectinload(Offer.driver))
        .where(Ride.id == ride_id, Ride.deleted_at.is_(None))
    )
    ride = result.scalar_one_or_none()
    if not ride:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corrida não encontrada")
    return ride


async def cancel_ride(db: AsyncSession, client: User, ride_id: uuid.UUID) -> Ride:
    ride = await get_ride(db, ride_id)
    if ride.client_id != client.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    if ride.status not in (RideStatus.open, RideStatus.matched):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Corrida não pode ser cancelada neste estado",
        )
    ride.status = RideStatus.cancelled
    await db.commit()
    await db.refresh(ride)
    return ride


# ─── Offer CRUD ───────────────────────────────────────────────────────────────

async def create_offer(
    db: AsyncSession, driver: User, ride_id: uuid.UUID, data: OfferCreateRequest
) -> Offer:
    if driver.role not in (UserRole.driver, UserRole.both):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas motoristas podem fazer propostas")

    # Check driver is approved
    if not driver.driver_profile or driver.driver_profile.verification_status != VerificationStatus.approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seu cadastro precisa estar aprovado para enviar propostas",
        )

    ride = await get_ride(db, ride_id)
    if ride.status != RideStatus.open:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Corrida não está aberta")

    # One offer per driver per ride
    existing = await db.execute(
        select(Offer).where(Offer.ride_id == ride_id, Offer.driver_id == driver.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Você já enviou uma proposta para esta corrida")

    offer = Offer(ride_id=ride_id, driver_id=driver.id, price=data.price, message=data.message)
    db.add(offer)
    await db.commit()
    await db.refresh(offer)

    # Notify client
    from app.tasks.notifications import send_push_to_user
    send_push_to_user.delay(
        str(ride.client_id),
        "Nova proposta recebida",
        f"{driver.name} enviou uma proposta de R$ {data.price:.2f}",
        {"type": "new_offer", "ride_id": str(ride_id), "offer_id": str(offer.id)},
    )

    return offer


async def list_ride_offers(db: AsyncSession, client: User, ride_id: uuid.UUID) -> list[Offer]:
    ride = await get_ride(db, ride_id)
    if ride.client_id != client.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    result = await db.execute(
        select(Offer)
        .options(selectinload(Offer.driver))
        .where(Offer.ride_id == ride_id)
        .order_by(Offer.price.asc())
    )
    return list(result.scalars().all())


async def accept_offer(db: AsyncSession, client: User, ride_id: uuid.UUID, offer_id: uuid.UUID) -> Ride:
    ride = await get_ride(db, ride_id)
    if ride.client_id != client.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    if ride.status != RideStatus.open:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Corrida não está aberta")

    result = await db.execute(select(Offer).where(Offer.id == offer_id, Offer.ride_id == ride_id))
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposta não encontrada")

    offer.status = OfferStatus.accepted
    ride.status = RideStatus.matched
    ride.accepted_offer_id = offer.id

    # Reject other pending offers
    await db.execute(
        select(Offer)
        .where(Offer.ride_id == ride_id, Offer.id != offer_id, Offer.status == OfferStatus.pending)
    )
    other_result = await db.execute(
        select(Offer).where(Offer.ride_id == ride_id, Offer.id != offer_id, Offer.status == OfferStatus.pending)
    )
    for other in other_result.scalars().all():
        other.status = OfferStatus.rejected

    await db.commit()
    await db.refresh(ride)

    # Notify accepted driver
    from app.tasks.notifications import send_push_to_user
    send_push_to_user.delay(
        str(offer.driver_id),
        "Proposta aceita!",
        "Sua proposta foi aceita. Prepare-se para o frete.",
        {"type": "offer_accepted", "ride_id": str(ride_id)},
    )

    return ride


async def cancel_offer(db: AsyncSession, driver: User, offer_id: uuid.UUID) -> Offer:
    result = await db.execute(select(Offer).where(Offer.id == offer_id, Offer.driver_id == driver.id))
    offer = result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposta não encontrada")
    if offer.status != OfferStatus.pending:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Proposta não pode ser cancelada")
    offer.status = OfferStatus.cancelled
    await db.commit()
    await db.refresh(offer)
    return offer


async def list_driver_offers(db: AsyncSession, driver: User) -> list[Offer]:
    result = await db.execute(
        select(Offer)
        .options(selectinload(Offer.ride))
        .where(Offer.driver_id == driver.id)
        .order_by(Offer.created_at.desc())
    )
    return list(result.scalars().all())


# ─── Driver location (Redis Geo) ──────────────────────────────────────────────

GEO_KEY = "frete:drivers:locations"


async def update_driver_location(driver_profile_id: str, lat: float, lng: float) -> None:
    redis = await get_redis()
    await redis.geoadd(GEO_KEY, [lng, lat, driver_profile_id])
    # TTL of 10 min — if driver goes silent, location expires
    await redis.expire(GEO_KEY, 600)


async def remove_driver_location(driver_profile_id: str) -> None:
    redis = await get_redis()
    await redis.zrem(GEO_KEY, driver_profile_id)


async def get_nearby_driver_ids(lat: float, lng: float, radius_km: float = 15.0) -> list[str]:
    redis = await get_redis()
    results = await redis.geosearch(
        GEO_KEY,
        longitude=lng,
        latitude=lat,
        radius=radius_km,
        unit="km",
        sort="ASC",
        count=30,
    )
    return [r.decode() if isinstance(r, bytes) else r for r in results]


async def set_driver_online(
    db: AsyncSession,
    driver: User,
    is_online: bool,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
) -> dict:
    if not driver.driver_profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Perfil de motorista não encontrado")

    driver.driver_profile.is_online = is_online

    if is_online and lat is not None and lng is not None:
        await update_driver_location(str(driver.driver_profile.id), lat, lng)
    elif not is_online:
        await remove_driver_location(str(driver.driver_profile.id))

    await db.commit()
    return {"is_online": is_online}
