import pytest
import json
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient

from tests.test_auth import REGISTER_URL, LOGIN_URL

RIDES_URL = "/api/v1/rides"
CONVERSATIONS_URL = "/api/v1/conversations"

RIDE_PAYLOAD = {
    "origin_address": "Rua A, 10, Uberlândia",
    "origin_lat": -18.9188,
    "origin_lng": -48.2769,
    "destination_address": "Rua B, 20, Uberlândia",
    "destination_lat": -18.9230,
    "destination_lng": -48.2900,
    "category": "carreto_simples",
}


async def _login(client: AsyncClient, email: str, phone: str, role: str) -> str:
    with patch("app.services.auth.send_phone_otp", new_callable=AsyncMock):
        await client.post(REGISTER_URL, json={
            "name": "Teste Chat",
            "email": email,
            "phone": phone,
            "password": "senha123",
            "role": role,
        })
    res = await client.post(LOGIN_URL, json={"email": email, "password": "senha123"})
    return res.json()["access_token"]


async def _approve_driver(client: AsyncClient, driver_token: str, admin_token: str) -> str:
    me = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {driver_token}"})
    dp_id = me.json()["driver_profile"]["id"]
    await client.patch(
        f"/api/v1/admin/drivers/{dp_id}/verify",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "approved"},
    )
    return dp_id


async def _setup_matched_ride(client: AsyncClient):
    """Create ride, make offer, accept it → ride is matched."""
    client_token = await _login(client, "chat_client@t.com", "34993330001", "client")
    driver_token = await _login(client, "chat_driver@t.com", "34993330002", "driver")
    admin_token = await _login(client, "chat_admin@t.com", "34993330003", "client")
    await _approve_driver(client, driver_token, admin_token)

    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        ride_res = await client.post(
            RIDES_URL,
            headers={"Authorization": f"Bearer {client_token}"},
            json=RIDE_PAYLOAD,
        )
    ride_id = ride_res.json()["id"]

    offer_res = await client.post(
        f"{RIDES_URL}/{ride_id}/offers",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"price": 100.0, "message": "Posso ir agora"},
    )
    offer_id = offer_res.json()["id"]

    await client.post(
        f"{RIDES_URL}/{ride_id}/offers/{offer_id}/accept",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    return ride_id, client_token, driver_token


# ─── REST send message ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_send_message_rest(client: AsyncClient):
    ride_id, client_token, _ = await _setup_matched_ride(client)
    res = await client.post(
        f"/api/v1/rides/{ride_id}/messages",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"content": "Olá motorista!"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["content"] == "Olá motorista!"
    assert data["is_read"] is False


@pytest.mark.asyncio
async def test_get_messages(client: AsyncClient):
    ride_id, client_token, driver_token = await _setup_matched_ride(client)

    await client.post(
        f"/api/v1/rides/{ride_id}/messages",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"content": "Olá!"},
    )
    await client.post(
        f"/api/v1/rides/{ride_id}/messages",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"content": "Estou a caminho"},
    )

    res = await client.get(
        f"/api/v1/rides/{ride_id}/messages",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert res.status_code == 200
    msgs = res.json()
    assert len(msgs) >= 2
    assert msgs[0]["content"] == "Olá!"
    assert msgs[1]["content"] == "Estou a caminho"


@pytest.mark.asyncio
async def test_outsider_cannot_send_message(client: AsyncClient):
    ride_id, _, _ = await _setup_matched_ride(client)
    outsider_token = await _login(client, "outsider_chat@t.com", "34993330010", "client")
    res = await client.post(
        f"/api/v1/rides/{ride_id}/messages",
        headers={"Authorization": f"Bearer {outsider_token}"},
        json={"content": "Intruso"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_chat_not_available_for_open_ride(client: AsyncClient):
    client_token = await _login(client, "open_ride_chat@t.com", "34993330011", "client")
    with patch("app.tasks.rides.notify_nearby_drivers.delay"):
        ride_res = await client.post(
            RIDES_URL,
            headers={"Authorization": f"Bearer {client_token}"},
            json=RIDE_PAYLOAD,
        )
    ride_id = ride_res.json()["id"]
    res = await client.post(
        f"/api/v1/rides/{ride_id}/messages",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"content": "Mensagem prematura"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_mark_messages_read(client: AsyncClient):
    ride_id, client_token, driver_token = await _setup_matched_ride(client)

    await client.post(
        f"/api/v1/rides/{ride_id}/messages",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"content": "Chegando em 10 min"},
    )

    # Client marks as read
    res = await client.post(
        f"/api/v1/rides/{ride_id}/messages/read",
        headers={"Authorization": f"Bearer {client_token}"},
    )
    assert res.status_code == 200
    assert res.json()["marked_read"] == 1


@pytest.mark.asyncio
async def test_empty_message_rejected(client: AsyncClient):
    ride_id, client_token, _ = await _setup_matched_ride(client)
    res = await client.post(
        f"/api/v1/rides/{ride_id}/messages",
        headers={"Authorization": f"Bearer {client_token}"},
        json={"content": "   "},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_conversations_list(client: AsyncClient):
    ride_id, client_token, driver_token = await _setup_matched_ride(client)
    await client.post(
        f"/api/v1/rides/{ride_id}/messages",
        headers={"Authorization": f"Bearer {driver_token}"},
        json={"content": "Estou no endereço"},
    )
    res = await client.get(CONVERSATIONS_URL, headers={"Authorization": f"Bearer {client_token}"})
    assert res.status_code == 200
    convs = res.json()
    assert len(convs) >= 1
    assert convs[0]["last_message"] == "Estou no endereço"
    assert convs[0]["unread_count"] >= 1
