from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, field_validator
from app.models.payment import PaymentMethod, PaymentStatus


class PaymentCreateRequest(BaseModel):
    method: PaymentMethod

    @field_validator("method")
    @classmethod
    def validate_method(cls, v: PaymentMethod) -> PaymentMethod:
        return v


class PaymentResponse(BaseModel):
    id: uuid.UUID
    ride_id: uuid.UUID
    client_id: uuid.UUID
    driver_id: uuid.UUID
    amount: float
    platform_fee: float
    driver_amount: float
    method: PaymentMethod
    status: PaymentStatus
    mp_payment_id: Optional[str] = None
    mp_preference_id: Optional[str] = None
    pix_qr_code_base64: Optional[str] = None
    pix_copy_paste: Optional[str] = None
    checkout_url: Optional[str] = None
    paid_at: Optional[datetime] = None
    released_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Mercado Pago webhook payload
class WebhookPayload(BaseModel):
    id: Optional[Any] = None
    action: Optional[str] = None
    type: Optional[str] = None
    data: Optional[dict] = None
    live_mode: Optional[bool] = None
