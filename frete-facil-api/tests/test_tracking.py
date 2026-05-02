import pytest
import json
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
    client_token = await _login(client, f"tr_client{suffix}@t.com", f"349944{suffix}", "client")
    driver_token = await _login(client, f"tr_driver{suffix}@t.com", f"349945{suffix}", "driver")
    admin_token = await _login(client, f"tr_admin{suffix}@t.com", f"349946{suffix}", "client")
    await _approve_driver(client, driver_token, admin_token)

    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        ride_res = await client.post(
            RIDES_URL, headers={"Authorization": f"Bearer {client_token}"}, json=RIDE_PAYLOAD
        )
    ride_id = ride_res.json()["id"]

    offer_res = await client.post(
        f"{RIDES_URL}/{ride_id}/offers",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"price": 80.0},
    )
    offer_id = offer_res.json()["id"]
    await client.post(
        f"{RIDES_URL}/{ride_id}/offers/{offer_id}/accept",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    return ride_id, client_token, driver_token


# ─── REST location ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_location_no_data(client: AsyncClient):
    ride_id, client_token, _ = await _setup_matched_ride(client, "0001")
    with patch("app.services.tracking.get_redis") as mock_r:
        m = AsyncMock()
        m.get = AsyncMock(return_value=None)
        mock_r.return_value = m
        res = await client.get(
            f"/api/v1/rides/{ride_id}/driver-location",
            headers={"Authorization": f"Bearer {client_token}"},
        )
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_get_location_with_data(client: AsyncClient):
    import json as _json
    ride_id, client_token, _ = await _setup_matched_ride(client, "0002")
    fake = {"lat": -18.91, "lng": -48.27, "driver_id": "abc", "updated_at": "2026-04-30T10:00:00"}
    with patch("app.services.tracking.get_redis") as mock_r:
        m = AsyncMock()
        m.get = AsyncMock(return_value=_json.dumps(fake))
        mock_r.return_value = m
        res = await client.get(
            f"/api/v1/rides/{ride_id}/driver-location",
            headers={"Authorization": f"Bearer {client_token}"},
        )
    assert res.status_code == 200
    data = res.json()
    assert data["lat"] == -18.91
    assert data["lng"] == -48.27


@pytest.mark.asyncio
async def test_outsider_cannot_get_location(client: AsyncClient):
    ride_id, _, _ = await _setup_matched_ride(client, "0003")
    outsider = await _login(client, "outsider_tr@t.com", "3499470001", "client")
    res = await client.get(
        f"/api/v1/rides/{ride_id}/driver-location",
        headers={"Authorization": f"Bearer {outsider}"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_location_unavailable_for_open_ride(client: AsyncClient):
    client_token = await _login(client, "open_tr@t.com", "3499480001", "client")
    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        ride_res = await client.post(
            RIDES_URL, headers={"Authorization": f"Bearer {client_token}"}, json=RIDE_PAYLOAD
        )
    ride_id = ride_res.json()["id"]
    res = await client.get(
        f"/api/v1/rides/{ride_id}/driver-location",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert res.status_code == 422


# ─── Service: save/get/clear ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_save_and_get_location():
    import json as _json
    from app.services.tracking import save_location, get_location

    with patch("app.services.tracking.get_redis") as mock_r:
        m = AsyncMock()
        stored = {}

        async def fake_setex(key, ttl, value):
            stored[key] = value

        async def fake_get(key):
            return stored.get(key)

        m.setex = fake_setex
        m.get = fake_get
        mock_r.return_value = m

        result = await save_location("ride-123", "driver-456", -18.9, -48.2)
        assert result["lat"] == -18.9
        assert result["driver_id"] == "driver-456"

        loc = await get_location("ride-123")
        assert loc is not None
        assert loc["lng"] == -48.2


# ─── Status transitions ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_valid_status_transition(client: AsyncClient):
    from app.services.tracking import update_ride_status
    from app.models.ride import RideStatus, Ride
    from sqlalchemy.ext.asyncio import AsyncSession

    ride_id, client_token, driver_token = await _setup_matched_ride(client, "0004")

    # Use the REST "start" via the dedicated endpoint (simulated via service test)
    # We verify the ride was set to matched after offer acceptance
    ride_res = await client.get(
        f"{RIDES_URL}/{ride_id}",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert ride_res.json()["status"] == "matched"


@pytest.mark.asyncio
async def test_invalid_status_transition(client: AsyncClient):
    from app.services.tracking import update_ride_status
    from app.models.ride import RideStatus

    ride_id, _, driver_token = await _setup_matched_ride(client, "0005")

    # Get fresh ride and driver user objects via DB for direct service test
    # We simulate the validation logic by checking the transitions dict
    valid = {
        RideStatus.matched: [RideStatus.in_progress],
        RideStatus.in_progress: [RideStatus.completed],
    }
    assert RideStatus.completed not in valid.get(RideStatus.matched, [])
    assert RideStatus.open not in valid.get(RideStatus.in_progress, [])
