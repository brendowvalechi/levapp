import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient

from tests.test_auth import REGISTER_URL, LOGIN_URL

RIDES_URL = "/api/v1/rides"
RIDE_PAYLOAD = {
    "origin_address": "Rua A, Uberlândia",
    "origin_lat": -18.9188,
    "origin_lng": -48.2769,
    "destination_address": "Rua B, Uberlândia",
    "destination_lat": -18.9230,
    "destination_lng": -48.2900,
    "category": "carreto_simples",
}


async def _login(client: AsyncClient, email: str, phone: str, role: str) -> str:
    with patch("app.services.auth.send_phone_otp", new_callable=AsyncMock):
        await client.post(REGISTER_URL, json={
            "name": "Teste", "email": email, "phone": phone,
            "password": "senha123", "role": role,
        })
    r = await client.post(LOGIN_URL, json={"email": email, "password": "senha123"})
    return r.json()["access_token"]


async def _approve_driver(client: AsyncClient, driver_token: str, admin_token: str):
    me = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {driver_token}"})
    dp_id = me.json()["driver_profile"]["id"]
    await client.patch(
        f"/api/v1/admin/drivers/{dp_id}/verify",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "approved"},
    )


async def _setup_matched_ride(client: AsyncClient, suffix: str):
    client_token = await _login(client, f"pay_client{suffix}@t.com", f"388810{suffix}", "client")
    driver_token = await _login(client, f"pay_driver{suffix}@t.com", f"388811{suffix}", "driver")
    admin_token = await _login(client, f"pay_admin{suffix}@t.com", f"388812{suffix}", "client")
    await _approve_driver(client, driver_token, admin_token)

    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        ride_res = await client.post(
            RIDES_URL, headers={"Authorization": f"Bearer {client_token}"}, json=RIDE_PAYLOAD
        )
    ride_id = ride_res.json()["id"]

    offer_res = await client.post(
        f"{RIDES_URL}/{ride_id}/offers",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"price": 150.0},
    )
    offer_id = offer_res.json()["id"]

    await client.post(
        f"{RIDES_URL}/{ride_id}/offers/{offer_id}/accept",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    return ride_id, client_token, driver_token


@pytest.mark.asyncio
async def test_create_pix_payment(client: AsyncClient):
    ride_id, client_token, _ = await _setup_matched_ride(client, "01")
    r = await client.post(
        f"{RIDES_URL}/{ride_id}/payment",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"method": "pix"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["method"] == "pix"
    assert body["status"] == "pending"
    assert body["amount"] == 150.0
    assert body["platform_fee"] == 15.0
    assert body["driver_amount"] == 135.0


@pytest.mark.asyncio
async def test_create_checkout_preference(client: AsyncClient):
    ride_id, client_token, _ = await _setup_matched_ride(client, "02")
    r = await client.post(
        f"{RIDES_URL}/{ride_id}/payment",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"method": "checkout_pro"},
    )
    assert r.status_code == 201
    assert r.json()["method"] == "checkout_pro"


@pytest.mark.asyncio
async def test_duplicate_payment_returns_existing(client: AsyncClient):
    ride_id, client_token, _ = await _setup_matched_ride(client, "03")
    r1 = await client.post(
        f"{RIDES_URL}/{ride_id}/payment",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"method": "pix"},
    )
    r2 = await client.post(
        f"{RIDES_URL}/{ride_id}/payment",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"method": "pix"},
    )
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["id"] == r2.json()["id"]


@pytest.mark.asyncio
async def test_get_payment_by_ride(client: AsyncClient):
    ride_id, client_token, driver_token = await _setup_matched_ride(client, "04")
    await client.post(
        f"{RIDES_URL}/{ride_id}/payment",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"method": "pix"},
    )
    r = await client.get(
        f"{RIDES_URL}/{ride_id}/payment",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r.status_code == 200
    assert r.json()["ride_id"] == ride_id


@pytest.mark.asyncio
async def test_driver_can_get_payment(client: AsyncClient):
    ride_id, client_token, driver_token = await _setup_matched_ride(client, "05")
    await client.post(
        f"{RIDES_URL}/{ride_id}/payment",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"method": "pix"},
    )
    r = await client.get(
        f"{RIDES_URL}/{ride_id}/payment",
        headers={"Authorization": f"Bearer {driver_token}"},
    )
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_payment_requires_matched_status(client: AsyncClient):
    client_token = await _login(client, "pay_early@t.com", "388820", "client")
    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        ride_res = await client.post(
            RIDES_URL, headers={"Authorization": f"Bearer {client_token}"}, json=RIDE_PAYLOAD
        )
    ride_id = ride_res.json()["id"]
    r = await client.post(
        f"{RIDES_URL}/{ride_id}/payment",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"method": "pix"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_webhook_ignored_without_payment_id(client: AsyncClient):
    r = await client.post(
        "/api/v1/payments/webhook",
        json={"action": "test", "type": "other"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "ignored"


@pytest.mark.asyncio
async def test_admin_release_payment(client: AsyncClient):
    ride_id, client_token, _ = await _setup_matched_ride(client, "06")
    admin_token = await _login(client, "pay_superadmin@t.com", "388830", "client")
    create_r = await client.post(
        f"{RIDES_URL}/{ride_id}/payment",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"method": "pix"},
    )
    payment_id = create_r.json()["id"]

    # Manually set to approved via service layer to test release
    from app.database import AsyncSessionLocal
    from app.models.payment import Payment, PaymentStatus
    import uuid as _uuid
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        res = await db.execute(select(Payment).where(Payment.id == _uuid.UUID(payment_id)))
        p = res.scalar_one()
        p.status = PaymentStatus.approved
        await db.commit()

    r = await client.post(
        f"/api/v1/admin/payments/{payment_id}/release",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "released"
