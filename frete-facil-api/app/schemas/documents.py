from pydantic import field_validator
from app.schemas.base import BaseSchema
from app.models.user import VerificationStatus


class PresignedUrlRequest(BaseSchema):
    folder: str
    content_type: str

    @field_validator("content_type")
    @classmethod
    def validate_mime(cls, v: str) -> str:
        allowed = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
        if v not in allowed:
            raise ValueError(f"content_type não permitido: {v}")
        return v

    @field_validator("folder")
    @classmethod
    def validate_folder(cls, v: str) -> str:
        allowed = {"cnh", "selfie", "crlv", "vehicle", "avatar", "cargo"}
        if v not in allowed:
            raise ValueError(f"folder inválido: {v}")
        return v


class PresignedUrlResponse(BaseSchema):
    upload_url: str
    public_url: str
    key: str


class DocumentsUpdateRequest(BaseSchema):
    cnh_number: str | None = None
    cnh_front_url: str | None = None
    cnh_back_url: str | None = None
    selfie_url: str | None = None


class VehicleCrlvUpdateRequest(BaseSchema):
    crlv_url: str


class AdminVerifyRequest(BaseSchema):
    status: VerificationStatus
    rejection_reason: str | None = None

    @field_validator("rejection_reason")
    @classmethod
    def reason_required_on_rejection(cls, v, info) -> str | None:
        if info.data.get("status") == VerificationStatus.rejected and not v:
            raise ValueError("Motivo de rejeição obrigatório")
        return v


class DriverUserSummary(BaseSchema):
    id: str
    name: str
    email: str
    phone: str


class DriverVerificationListItem(BaseSchema):
    id: str
    user_id: str
    user: DriverUserSummary
    cnh_number: str | None
    cnh_front_url: str | None
    cnh_back_url: str | None
    selfie_url: str | None
    verification_status: VerificationStatus
    rejection_reason: str | None
    rating_avg: float
    rating_count: int
    total_rides: int
    total_vehicles: int
    created_at: str
    updated_at: str
