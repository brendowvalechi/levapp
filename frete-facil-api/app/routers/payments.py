from __future__ import annotations
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user, require_admin
from app.models.payment import PaymentMethod
from app.models.user import User
from app.schemas.payment import PaymentCreateRequest, PaymentResponse, WebhookPayload
from app.services import payment as svc

router = APIRouter(prefix="/api/v1", tags=["payments"])


@router.post(
    "/rides/{ride_id}/payment",
    response_model=PaymentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_payment(
    ride_id: uuid.UUID,
    body: PaymentCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.method == PaymentMethod.pix:
        return await svc.create_pix_payment(db, user, ride_id)
    return await svc.create_checkout_preference(db, user, ride_id)


@router.get("/rides/{ride_id}/payment", response_model=PaymentResponse)
async def get_payment(
    ride_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await svc.get_payment_by_ride(db, user, ride_id)


@router.post("/payments/webhook", status_code=status.HTTP_200_OK)
async def mercadopago_webhook(
    request: Request,
    payload: WebhookPayload,
    db: AsyncSession = Depends(get_db),
    x_signature: str = Header(default=""),
    x_request_id: str = Header(default=""),
):
    # Extract mp_payment_id from payload
    mp_payment_id: str | None = None
    ts = ""

    if payload.type == "payment" and payload.data:
        mp_payment_id = str(payload.data.get("id", ""))
    elif payload.action in ("payment.created", "payment.updated") and payload.data:
        mp_payment_id = str(payload.data.get("id", ""))

    if not mp_payment_id:
        return {"status": "ignored"}

    # Verify signature when secret is configured
    parts = dict(p.split("=", 1) for p in x_signature.split(",") if "=" in p)
    ts = parts.get("ts", "")

    if not svc.verify_webhook_signature(x_signature, x_request_id, mp_payment_id, ts):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid signature")

    await svc.handle_webhook(db, mp_payment_id)
    return {"status": "ok"}


# Admin endpoints
@router.get("/admin/payments", response_model=list[PaymentResponse])
async def admin_list_payments(
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    return await svc.list_payments(db, page, page_size)


@router.post("/admin/payments/{payment_id}/release", response_model=PaymentResponse)
async def admin_release_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    return await svc.release_payment(db, payment_id)
