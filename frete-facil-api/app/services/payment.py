from __future__ import annotations
import hashlib
import hmac
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.payment import Payment, PaymentMethod, PaymentStatus
from app.models.ride import Ride, Offer, RideStatus
from app.models.user import User

_MP_API = "https://api.mercadopago.com"
_PLATFORM_FEE_PCT = 0.10


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.MERCADOPAGO_ACCESS_TOKEN}",
        "Content-Type": "application/json",
        "X-Idempotency-Key": str(uuid.uuid4()),
    }


async def _get_ride_for_payment(
    db: AsyncSession, client: User, ride_id: uuid.UUID
) -> tuple[Ride, Offer]:
    result = await db.execute(select(Ride).where(Ride.id == ride_id, Ride.deleted_at.is_(None)))
    ride = result.scalar_one_or_none()
    if not ride:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corrida não encontrada")
    if ride.client_id != client.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    if ride.status != RideStatus.matched:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Pagamento disponível apenas quando motorista foi aceito",
        )
    if not ride.accepted_offer_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Corrida sem oferta aceita",
        )
    offer_result = await db.execute(
        select(Offer).where(Offer.id == ride.accepted_offer_id)
    )
    offer = offer_result.scalar_one_or_none()
    if not offer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Oferta não encontrada")
    return ride, offer


async def _get_existing_payment(db: AsyncSession, ride_id: uuid.UUID) -> Optional[Payment]:
    result = await db.execute(select(Payment).where(Payment.ride_id == ride_id))
    return result.scalar_one_or_none()


def _calc_amounts(amount: float) -> tuple[float, float]:
    fee = round(amount * _PLATFORM_FEE_PCT, 2)
    driver = round(amount - fee, 2)
    return fee, driver


async def create_pix_payment(
    db: AsyncSession, client: User, ride_id: uuid.UUID
) -> Payment:
    ride, offer = await _get_ride_for_payment(db, client, ride_id)

    existing = await _get_existing_payment(db, ride_id)
    if existing:
        return existing

    amount = offer.price
    platform_fee, driver_amount = _calc_amounts(amount)

    payload = {
        "transaction_amount": amount,
        "description": f"Levapp — Corrida {ride_id}",
        "payment_method_id": "pix",
        "payer": {"email": client.email},
        "notification_url": f"{settings.APP_BASE_URL}/api/v1/payments/webhook",
    }

    mp_payment_id: Optional[str] = None
    qr_base64: Optional[str] = None
    copy_paste: Optional[str] = None

    if settings.MERCADOPAGO_ACCESS_TOKEN:
        async with httpx.AsyncClient(timeout=15) as http:
            resp = await http.post(f"{_MP_API}/v1/payments", json=payload, headers=_headers())
        if resp.status_code not in (200, 201):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Mercado Pago error: {resp.text}",
            )
        data = resp.json()
        mp_payment_id = str(data["id"])
        pt = data.get("point_of_interaction", {}).get("transaction_data", {})
        qr_base64 = pt.get("qr_code_base64")
        copy_paste = pt.get("qr_code")

    payment = Payment(
        ride_id=ride_id,
        client_id=client.id,
        driver_id=offer.driver_id,
        amount=amount,
        platform_fee=platform_fee,
        driver_amount=driver_amount,
        method=PaymentMethod.pix,
        status=PaymentStatus.pending,
        mp_payment_id=mp_payment_id,
        pix_qr_code_base64=qr_base64,
        pix_copy_paste=copy_paste,
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    return payment


async def create_checkout_preference(
    db: AsyncSession, client: User, ride_id: uuid.UUID
) -> Payment:
    ride, offer = await _get_ride_for_payment(db, client, ride_id)

    existing = await _get_existing_payment(db, ride_id)
    if existing:
        return existing

    amount = offer.price
    platform_fee, driver_amount = _calc_amounts(amount)

    payload = {
        "items": [
            {
                "title": f"Frete — {ride.origin_address[:50]} → {ride.destination_address[:50]}",
                "quantity": 1,
                "unit_price": amount,
                "currency_id": "BRL",
            }
        ],
        "payer": {"email": client.email},
        "notification_url": f"{settings.APP_BASE_URL}/api/v1/payments/webhook",
        "back_urls": {
            "success": f"{settings.APP_BASE_URL}/payment/success",
            "failure": f"{settings.APP_BASE_URL}/payment/failure",
            "pending": f"{settings.APP_BASE_URL}/payment/pending",
        },
        "auto_return": "approved",
        "external_reference": str(ride_id),
    }

    mp_preference_id: Optional[str] = None
    checkout_url: Optional[str] = None

    if settings.MERCADOPAGO_ACCESS_TOKEN:
        async with httpx.AsyncClient(timeout=15) as http:
            resp = await http.post(
                f"{_MP_API}/checkout/preferences", json=payload, headers=_headers()
            )
        if resp.status_code not in (200, 201):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Mercado Pago error: {resp.text}",
            )
        data = resp.json()
        mp_preference_id = data.get("id")
        checkout_url = data.get("init_point")

    payment = Payment(
        ride_id=ride_id,
        client_id=client.id,
        driver_id=offer.driver_id,
        amount=amount,
        platform_fee=platform_fee,
        driver_amount=driver_amount,
        method=PaymentMethod.checkout_pro,
        status=PaymentStatus.pending,
        mp_preference_id=mp_preference_id,
        checkout_url=checkout_url,
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    return payment


async def get_payment_by_ride(db: AsyncSession, user: User, ride_id: uuid.UUID) -> Payment:
    existing = await _get_existing_payment(db, ride_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pagamento não encontrado")
    if existing.client_id != user.id and existing.driver_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
    return existing


def verify_webhook_signature(
    x_signature: str, x_request_id: str, mp_payment_id: str, ts: str
) -> bool:
    if not settings.MERCADOPAGO_WEBHOOK_SECRET:
        return True  # dev: skip validation
    manifest = f"id:{mp_payment_id};request-id:{x_request_id};ts:{ts};"
    expected = hmac.new(
        settings.MERCADOPAGO_WEBHOOK_SECRET.encode(),
        manifest.encode(),
        hashlib.sha256,
    ).hexdigest()  # type: ignore[attr-defined]
    # x_signature format: "ts=...,v1=<hex>"
    parts = dict(p.split("=", 1) for p in x_signature.split(",") if "=" in p)
    return hmac.compare_digest(parts.get("v1", ""), expected)


async def handle_webhook(db: AsyncSession, mp_payment_id: str) -> None:
    """Fetch payment status from MP and update our record."""
    if not settings.MERCADOPAGO_ACCESS_TOKEN:
        return

    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.get(
            f"{_MP_API}/v1/payments/{mp_payment_id}",
            headers={"Authorization": f"Bearer {settings.MERCADOPAGO_ACCESS_TOKEN}"},
        )
    if resp.status_code != 200:
        return

    data = resp.json()
    mp_status = data.get("status")

    # Try to find payment by mp_payment_id (Pix) or by external_reference (Checkout Pro)
    result = await db.execute(select(Payment).where(Payment.mp_payment_id == str(mp_payment_id)))
    payment = result.scalar_one_or_none()

    if not payment:
        # Checkout Pro: mp_payment_id was not stored at creation — match via external_reference
        external_ref = data.get("external_reference")
        if external_ref:
            try:
                ride_uuid = uuid.UUID(external_ref)
            except ValueError:
                return
            result2 = await db.execute(
                select(Payment).where(
                    Payment.ride_id == ride_uuid,
                    Payment.method == PaymentMethod.checkout_pro,
                )
            )
            payment = result2.scalar_one_or_none()
            if payment:
                # Persist the real payment ID so future webhooks resolve instantly
                payment.mp_payment_id = str(mp_payment_id)

    if not payment:
        return

    if mp_status == "approved" and payment.status == PaymentStatus.pending:
        payment.status = PaymentStatus.approved
        payment.paid_at = datetime.now(timezone.utc)
        await db.commit()

        # Notify driver that payment was confirmed
        from app.tasks.notifications import send_push_to_user
        send_push_to_user.delay(
            str(payment.driver_id),
            "Pagamento confirmado!",
            f"O cliente pagou R$ {payment.driver_amount:.2f} pelo frete. Aguarde a liberação.",
            {"type": "payment_approved", "ride_id": str(payment.ride_id)},
        )


async def release_payment(db: AsyncSession, payment_id: uuid.UUID) -> Payment:
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pagamento não encontrado")
    if payment.status not in (PaymentStatus.approved, PaymentStatus.in_escrow):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Pagamento não pode ser liberado (status: {payment.status})",
        )
    payment.status = PaymentStatus.released
    payment.released_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(payment)
    return payment


async def list_payments(db: AsyncSession, page: int = 1, page_size: int = 50) -> list[Payment]:
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Payment).order_by(Payment.created_at.desc()).offset(offset).limit(page_size)
    )
    return list(result.scalars().all())
