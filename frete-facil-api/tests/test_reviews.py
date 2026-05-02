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


async def _setup_completed_ride(client: AsyncClient, suffix: str):
    """Create a matched ride, then manually move it to completed."""
    client_token = await _login(client, f"rv_client{suffix}@t.com", f"399900{suffix}", "client")
    driver_token = await _login(client, f"rv_driver{suffix}@t.com", f"399901{suffix}", "driver")
    admin_token = await _login(client, f"rv_admin{suffix}@t.com", f"399902{suffix}", "client")
    await _approve_driver(client, driver_token, admin_token)

    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        ride_res = await client.post(
            RIDES_URL, headers={"Authorization": f"Bearer {client_token}"}, json=RIDE_PAYLOAD
        )
    ride_id = ride_res.json()["id"]

    offer_res = await client.post(
        f"{RIDES_URL}/{ride_id}/offers",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"price": 100.0},
    )
    offer_id = offer_res.json()["id"]

    await client.post(
        f"{RIDES_URL}/{ride_id}/offers/{offer_id}/accept",
        headers={"Authorization": f"Bearer {client_token}"},
    )

    # Force ride to completed via DB
    from app.database import AsyncSessionLocal
    from app.models.ride import Ride, RideStatus
    import uuid as _uuid
    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        res = await db.execute(select(Ride).where(Ride.id == _uuid.UUID(ride_id)))
        ride = res.scalar_one()
        ride.status = RideStatus.completed
        await db.commit()

    return ride_id, client_token, driver_token


@pytest.mark.asyncio
async def test_client_can_review_driver(client: AsyncClient):
    ride_id, client_token, _ = await _setup_completed_ride(client, "01")
    r = await client.post(
        f"{RIDES_URL}/{ride_id}/review",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"rating": 5, "comment": "Excelente motorista!"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["rating"] == 5
    assert body["comment"] == "Excelente motorista!"


@pytest.mark.asyncio
async def test_driver_can_review_client(client: AsyncClient):
    ride_id, _, driver_token = await _setup_completed_ride(client, "02")
    r = await client.post(
        f"{RIDES_URL}/{ride_id}/review",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"rating": 4},
    )
    assert r.status_code == 201
    assert r.json()["rating"] == 4


@pytest.mark.asyncio
async def test_duplicate_review_is_rejected(client: AsyncClient):
    ride_id, client_token, _ = await _setup_completed_ride(client, "03")
    await client.post(
        f"{RIDES_URL}/{ride_id}/review",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"rating": 3},
    )
    r = await client.post(
        f"{RIDES_URL}/{ride_id}/review",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"rating": 5},
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_review_requires_completed_ride(client: AsyncClient):
    client_token = await _login(client, "rv_early@t.com", "399910", "client")
    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        ride_res = await client.post(
            RIDES_URL, headers={"Authorization": f"Bearer {client_token}"}, json=RIDE_PAYLOAD
        )
    ride_id = ride_res.json()["id"]
    r = await client.post(
        f"{RIDES_URL}/{ride_id}/review",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"rating": 5},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_invalid_rating_rejected(client: AsyncClient):
    ride_id, client_token, _ = await _setup_completed_ride(client, "04")
    r = await client.post(
        f"{RIDES_URL}/{ride_id}/review",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"rating": 6},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_driver_rating_updates_after_review(client: AsyncClient):
    ride_id, client_token, driver_token = await _setup_completed_ride(client, "05")
    await client.post(
        f"{RIDES_URL}/{ride_id}/review",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"rating": 4},
    )

    me = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {driver_token}"})
    driver_user_id = me.json()["id"]

    r = await client.get(
        f"/api/v1/users/{driver_user_id}/rating",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["rating_count"] == 1
    assert body["rating_avg"] == 4.0


@pytest.mark.asyncio
async def test_get_ride_reviews(client: AsyncClient):
    ride_id, client_token, driver_token = await _setup_completed_ride(client, "06")
    await client.post(
        f"{RIDES_URL}/{ride_id}/review",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"rating": 5, "comment": "Ótimo!"},
    )
    r = await client.get(
        f"{RIDES_URL}/{ride_id}/reviews",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert r.status_code == 200
    assert len(r.json()) == 1
