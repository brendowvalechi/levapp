import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient

from tests.test_auth import REGISTER_URL, LOGIN_URL

RIDES_URL = "/api/v1/rides"
ONLINE_URL = "/api/v1/driver/online"
LOCATION_URL = "/api/v1/driver/location"

RIDE_PAYLOAD = {
    "origin_address": "Rua das Flores, 100, Uberlândia - MG",
    "origin_lat": -18.9188,
    "origin_lng": -48.2769,
    "destination_address": "Av. Rondon Pacheco, 500, Uberlândia - MG",
    "destination_lat": -18.9230,
    "destination_lng": -48.2900,
    "category": "carreto_simples",
    "description": "Mover sofá e geladeira",
    "estimated_weight_kg": 150,
}


async def _register_and_login(client: AsyncClient, email: str, phone: str, role: str) -> str:
    with patch("app.services.auth.send_phone_otp", new_callable=AsyncMock):
        await client.post(REGISTER_URL, json={
            "name": "Usuário Teste",
            "email": email,
            "phone": phone,
            "password": "senha123",
            "role": role,
        })
    res = await client.post(LOGIN_URL, json={"email": email, "password": "senha123"})
    return res.json()["access_token"]


async def _approve_driver(client: AsyncClient, driver_token: str, admin_token: str):
    me = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {driver_token}"})
    dp_id = me.json()["driver_profile"]["id"]
    await client.patch(
        f"/api/v1/admin/drivers/{dp_id}/verify",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "approved"},
    )


# ─── Ride creation ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_ride_success(client: AsyncClient):
    token = await _register_and_login(client, "ride_client@t.com", "34992220001", "client")
    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        res = await client.post(
            RIDES_URL,
            headers={"Authorization": f"Bearer {token}"},
            json=RIDE_PAYLOAD,
        )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "open"
    assert data["category"] == "carreto_simples"
    assert data["distance_km"] is not None
    assert data["distance_km"] > 0


@pytest.mark.asyncio
async def test_create_ride_requires_auth(client: AsyncClient):
    res = await client.post(RIDES_URL, json=RIDE_PAYLOAD)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_list_my_rides(client: AsyncClient):
    token = await _register_and_login(client, "myrides_client@t.com", "34992220002", "client")
    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        await client.post(RIDES_URL, headers={"Authorization": f"Bearer {token}"}, json=RIDE_PAYLOAD)
    res = await client.get(f"{RIDES_URL}/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert len(res.json()) >= 1


@pytest.mark.asyncio
async def test_cancel_ride(client: AsyncClient):
    token = await _register_and_login(client, "cancel_ride@t.com", "34992220003", "client")
    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        create_res = await client.post(RIDES_URL, headers={"Authorization": f"Bearer {token}"}, json=RIDE_PAYLOAD)
    ride_id = create_res.json()["id"]

    res = await client.post(
        f"{RIDES_URL}/{ride_id}/cancel",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


# ─── Open rides (driver view) ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_driver_can_list_open_rides(client: AsyncClient):
    client_token = await _register_and_login(client, "open_client@t.com", "34992220004", "client")
    driver_token = await _register_and_login(client, "open_driver@t.com", "34992220005", "driver")

    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        await client.post(RIDES_URL, headers={"Authorization": f"Bearer {client_token}"}, json=RIDE_PAYLOAD)

    res = await client.get(f"{RIDES_URL}/open", headers={"Authorization": f"Bearer {driver_token}"})
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_client_cannot_list_open_rides(client: AsyncClient):
    token = await _register_and_login(client, "not_driver@t.com", "34992220006", "client")
    res = await client.get(f"{RIDES_URL}/open", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403


# ─── Offers ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_driver_make_offer_requires_approval(client: AsyncClient):
    client_token = await _register_and_login(client, "offer_client1@t.com", "34992220007", "client")
    driver_token = await _register_and_login(client, "offer_driver1@t.com", "34992220008", "driver")

    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        ride_res = await client.post(RIDES_URL, headers={"Authorization": f"Bearer {client_token}"}, json=RIDE_PAYLOAD)
    ride_id = ride_res.json()["id"]

    res = await client.post(
        f"{RIDES_URL}/{ride_id}/offers",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"price": 120.0, "message": "Posso fazer agora"},
    )
    assert res.status_code == 403  # not approved yet


@pytest.mark.asyncio
async def test_driver_make_offer_success(client: AsyncClient):
    client_token = await _register_and_login(client, "offer_client2@t.com", "34992220009", "client")
    driver_token = await _register_and_login(client, "offer_driver2@t.com", "34992220010", "driver")
    admin_token = await _register_and_login(client, "offer_admin2@t.com", "34992220011", "client")
    await _approve_driver(client, driver_token, admin_token)

    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        ride_res = await client.post(RIDES_URL, headers={"Authorization": f"Bearer {client_token}"}, json=RIDE_PAYLOAD)
    ride_id = ride_res.json()["id"]

    res = await client.post(
        f"{RIDES_URL}/{ride_id}/offers",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"price": 150.0, "message": "Tenho caminhonete disponível"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["price"] == 150.0
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_duplicate_offer_rejected(client: AsyncClient):
    client_token = await _register_and_login(client, "dup_offer_client@t.com", "34992220012", "client")
    driver_token = await _register_and_login(client, "dup_offer_driver@t.com", "34992220013", "driver")
    admin_token = await _register_and_login(client, "dup_offer_admin@t.com", "34992220014", "client")
    await _approve_driver(client, driver_token, admin_token)

    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        ride_res = await client.post(RIDES_URL, headers={"Authorization": f"Bearer {client_token}"}, json=RIDE_PAYLOAD)
    ride_id = ride_res.json()["id"]

    payload = {"price": 100.0}
    await client.post(f"{RIDES_URL}/{ride_id}/offers", headers={"Authorization": f"Bearer {driver_token}"}, json=payload)
    res = await client.post(f"{RIDES_URL}/{ride_id}/offers", headers={"Authorization": f"Bearer {driver_token}"}, json=payload)
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_accept_offer(client: AsyncClient):
    client_token = await _register_and_login(client, "accept_client@t.com", "34992220015", "client")
    driver_token = await _register_and_login(client, "accept_driver@t.com", "34992220016", "driver")
    admin_token = await _register_and_login(client, "accept_admin@t.com", "34992220017", "client")
    await _approve_driver(client, driver_token, admin_token)

    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        ride_res = await client.post(RIDES_URL, headers={"Authorization": f"Bearer {client_token}"}, json=RIDE_PAYLOAD)
    ride_id = ride_res.json()["id"]

    offer_res = await client.post(
        f"{RIDES_URL}/{ride_id}/offers",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"price": 200.0},
    )
    offer_id = offer_res.json()["id"]

    res = await client.post(
        f"{RIDES_URL}/{ride_id}/offers/{offer_id}/accept",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "matched"
    assert str(data["accepted_offer_id"]) == offer_id


# ─── Driver online / location ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_driver_toggle_online(client: AsyncClient):
    driver_token = await _register_and_login(client, "online_driver@t.com", "34992220018", "driver")
    with patch("app.services.rides.get_redis") as mock_redis:
        mock_r = AsyncMock()
        mock_redis.return_value = mock_r
        res = await client.post(
            ONLINE_URL,
            headers={"Authorization": f"Bearer {driver_token}"},
            json={"is_online": True},
        )
    assert res.status_code == 200
    assert res.json()["is_online"] is True


@pytest.mark.asyncio
async def test_location_update(client: AsyncClient):
    driver_token = await _register_and_login(client, "loc_driver@t.com", "34992220019", "driver")
    with patch("app.services.rides.get_redis") as mock_redis:
        mock_r = AsyncMock()
        mock_redis.return_value = mock_r
        res = await client.post(
            LOCATION_URL,
            headers={"Authorization": f"Bearer {driver_token}"},
            json={"lat": -18.9188, "lng": -48.2769},
        )
    assert res.status_code == 200
    assert res.json()["ok"] is True
