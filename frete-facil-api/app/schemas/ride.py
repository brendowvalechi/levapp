from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from pydantic import Field, field_validator
from app.schemas.base import BaseSchema
from app.models.ride import RideCategory, RideStatus, OfferStatus
from app.models.user import VehicleType


# ─── Ride ────────────────────────────────────────────────────────────────────

class RideCreateRequest(BaseSchema):
    origin_address: str = Field(..., min_length=5)
    origin_lat: float
    origin_lng: float
    destination_address: str = Field(..., min_length=5)
    destination_lat: float
    destination_lng: float
    description: Optional[str] = None
    category: RideCategory
    vehicle_type_preference: Optional[VehicleType] = None
    estimated_weight_kg: Optional[int] = Field(None, ge=1, le=50000)
    photos: list[str] = Field(default_factory=list)
    scheduled_at: Optional[datetime] = None


class ClientSummary(BaseSchema):
    id: uuid.UUID
    name: str
    phone: str
    rating_avg: float = 0.0


class DriverSummary(BaseSchema):
    id: uuid.UUID
    name: str
    phone: str


class RideResponse(BaseSchema):
    id: uuid.UUID
    client_id: uuid.UUID
    origin_address: str
    origin_lat: float
    origin_lng: float
    destination_address: str
    destination_lat: float
    destination_lng: float
    description: Optional[str]
    category: RideCategory
    vehicle_type_preference: Optional[str]
    estimated_weight_kg: Optional[int]
    status: RideStatus
    photos: list[str]
    accepted_offer_id: Optional[uuid.UUID]
    distance_km: Optional[float]
    scheduled_at: Optional[datetime]
    expires_at: datetime
    created_at: datetime
    offers_count: int = 0


class RideDetailResponse(RideResponse):
    offers: list["OfferResponse"] = []


# ─── Offer ───────────────────────────────────────────────────────────────────

class OfferCreateRequest(BaseSchema):
    price: float = Field(..., gt=0, le=99999)
    message: Optional[str] = Field(None, max_length=500)


class OfferResponse(BaseSchema):
    id: uuid.UUID
    ride_id: uuid.UUID
    driver_id: uuid.UUID
    price: float
    message: Optional[str]
    status: OfferStatus
    created_at: datetime
    driver: Optional[DriverSummary] = None


# ─── Driver location / online ─────────────────────────────────────────────────

class LocationUpdateRequest(BaseSchema):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)


class OnlineToggleRequest(BaseSchema):
    is_online: bool
