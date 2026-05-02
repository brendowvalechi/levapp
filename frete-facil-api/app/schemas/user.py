import uuid
from datetime import datetime
from pydantic import EmailStr
from app.schemas.base import BaseSchema
from app.models.user import UserRole, VerificationStatus, VehicleType


class UserResponse(BaseSchema):
    id: uuid.UUID
    name: str
    email: EmailStr
    phone: str
    role: UserRole
    avatar_url: str | None
    is_active: bool
    email_verified: bool
    phone_verified: bool
    created_at: datetime


class UserUpdateRequest(BaseSchema):
    name: str | None = None
    avatar_url: str | None = None
    fcm_token: str | None = None


class DriverProfileResponse(BaseSchema):
    id: uuid.UUID
    user_id: uuid.UUID
    verification_status: VerificationStatus
    service_radius_km: int
    service_types: list
    working_days: dict
    working_hours: dict
    pix_key: str | None
    is_online: bool
    rating_avg: float
    rating_count: int = 0
    total_rides: int


class DriverProfileUpdateRequest(BaseSchema):
    service_radius_km: int | None = None
    service_types: list | None = None
    working_days: dict | None = None
    working_hours: dict | None = None
    pix_key: str | None = None


class VehicleCreateRequest(BaseSchema):
    type: VehicleType
    plate: str
    brand: str
    model: str
    year: int
    capacity_kg: int | None = None
    color: str | None = None


class VehicleResponse(BaseSchema):
    id: uuid.UUID
    type: VehicleType
    plate: str
    brand: str
    model: str
    year: int
    capacity_kg: int | None
    color: str | None
    photos: list
    crlv_url: str | None
    is_active: bool


class UserWithProfileResponse(UserResponse):
    driver_profile: DriverProfileResponse | None = None
