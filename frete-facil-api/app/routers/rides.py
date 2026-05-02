import uuid
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user, require_driver
from app.models.user import User
from app.models.ride import RideStatus
from app.schemas.ride import (
    RideCreateRequest,
    RideResponse,
    RideDetailResponse,
    OfferCreateRequest,
    OfferResponse,
    LocationUpdateRequest,
    OnlineToggleRequest,
)
from app.services import rides as ride_service

router = APIRouter(prefix="/api/v1", tags=["rides"])


# ─── Client: publicar e gerenciar corridas ────────────────────────────────────

@router.post("/rides", response_model=RideResponse, status_code=201)
async def create_ride(
    data: RideCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ride = await ride_service.create_ride(db, current_user, data)
    # Fire-and-forget: notify nearby drivers via Celery
    from app.tasks.rides import notify_nearby_drivers
    notify_nearby_drivers.delay(str(ride.id))
    return _ride_response(ride)


@router.get("/rides/me", response_model=list[RideResponse])
async def my_rides(
    status: Annotated[Optional[RideStatus], Query()] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rides = await ride_service.list_client_rides(db, current_user, status)
    return [_ride_response(r) for r in rides]


@router.get("/rides/open", response_model=list[RideResponse])
async def open_rides(
    lat: Annotated[Optional[float], Query()] = None,
    lng: Annotated[Optional[float], Query()] = None,
    radius_km: Annotated[float, Query(ge=1, le=100)] = 30.0,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_driver),
):
    rides = await ride_service.list_open_rides(db, lat, lng, radius_km)
    return [_ride_response(r) for r in rides]


@router.get("/rides/{ride_id}", response_model=RideDetailResponse)
async def get_ride(
    ride_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ride = await ride_service.get_ride(db, ride_id)
    return _ride_detail_response(ride)


@router.post("/rides/{ride_id}/cancel", response_model=RideResponse)
async def cancel_ride(
    ride_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ride = await ride_service.cancel_ride(db, current_user, ride_id)
    return _ride_response(ride)


# ─── Offers ───────────────────────────────────────────────────────────────────

@router.post("/rides/{ride_id}/offers", response_model=OfferResponse, status_code=201)
async def create_offer(
    ride_id: uuid.UUID,
    data: OfferCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_driver),
):
    offer = await ride_service.create_offer(db, current_user, ride_id, data)
    return offer


@router.get("/rides/{ride_id}/offers", response_model=list[OfferResponse])
async def list_offers(
    ride_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    offers = await ride_service.list_ride_offers(db, current_user, ride_id)
    return offers


@router.post("/rides/{ride_id}/offers/{offer_id}/accept", response_model=RideDetailResponse)
async def accept_offer(
    ride_id: uuid.UUID,
    offer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ride = await ride_service.accept_offer(db, current_user, ride_id, offer_id)
    return _ride_detail_response(ride)


@router.post("/offers/{offer_id}/cancel", response_model=OfferResponse)
async def cancel_offer(
    offer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_driver),
):
    return await ride_service.cancel_offer(db, current_user, offer_id)


@router.get("/offers/me", response_model=list[OfferResponse])
async def my_offers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_driver),
):
    return await ride_service.list_driver_offers(db, current_user)


# ─── Driver location ──────────────────────────────────────────────────────────

@router.post("/driver/online")
async def toggle_online(
    data: OnlineToggleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_driver),
):
    return await ride_service.set_driver_online(db, current_user, data.is_online)


@router.post("/driver/location")
async def update_location(
    data: LocationUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_driver),
):
    if not current_user.driver_profile:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Perfil de motorista não encontrado")
    await ride_service.update_driver_location(str(current_user.driver_profile.id), data.lat, data.lng)
    return {"ok": True}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _ride_response(ride) -> dict:
    return {
        "id": ride.id,
        "client_id": ride.client_id,
        "origin_address": ride.origin_address,
        "origin_lat": ride.origin_lat,
        "origin_lng": ride.origin_lng,
        "destination_address": ride.destination_address,
        "destination_lat": ride.destination_lat,
        "destination_lng": ride.destination_lng,
        "description": ride.description,
        "category": ride.category,
        "vehicle_type_preference": ride.vehicle_type_preference,
        "estimated_weight_kg": ride.estimated_weight_kg,
        "status": ride.status,
        "photos": ride.photos,
        "accepted_offer_id": ride.accepted_offer_id,
        "distance_km": ride.distance_km,
        "scheduled_at": ride.scheduled_at,
        "expires_at": ride.expires_at,
        "created_at": ride.created_at,
        "offers_count": len(ride.offers) if ride.offers else 0,
    }


def _ride_detail_response(ride) -> dict:
    base = _ride_response(ride)
    base["offers"] = ride.offers or []
    return base
