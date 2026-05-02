import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock


REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
REFRESH_URL = "/api/v1/auth/refresh"
OTP_VERIFY_URL = "/api/v1/auth/otp/verify"
OTP_RESEND_URL = "/api/v1/auth/otp/resend"
ME_URL = "/api/v1/users/me"


def client_payload(**overrides) -> dict:
    base = {
        "name": "Maria Silva",
        "email": "maria@teste.com",
        "phone": "34991234567",
        "password": "senha123",
        "role": "client",
    }
    base.update(overrides)
    return base


# ─── Register ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_register_client_success(client: AsyncClient):
    with patch("app.services.auth.send_phone_otp", new_callable=AsyncMock):
        res = await client.post(REGISTER_URL, json=client_payload())
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "maria@teste.com"
    assert data["role"] == "client"
    assert data["phone_verified"] is False


@pytest.mark.asyncio
async def test_register_driver_creates_profile(client: AsyncClient):
    with patch("app.services.auth.send_phone_otp", new_callable=AsyncMock):
        res = await client.post(REGISTER_URL, json=client_payload(
            email="motorista@teste.com",
            phone="34991234568",
            role="driver",
        ))
    assert res.status_code == 201
    assert res.json()["role"] == "driver"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient):
    payload = client_payload(email="dup@teste.com", phone="34991234569")
    with patch("app.services.auth.send_phone_otp", new_callable=AsyncMock):
        await client.post(REGISTER_URL, json=payload)
        res = await client.post(REGISTER_URL, json={**payload, "phone": "34991234570"})
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_register_duplicate_phone(client: AsyncClient):
    payload = client_payload(email="a@teste.com", phone="34991234571")
    with patch("app.services.auth.send_phone_otp", new_callable=AsyncMock):
        await client.post(REGISTER_URL, json=payload)
        res = await client.post(REGISTER_URL, json={**payload, "email": "b@teste.com"})
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_register_short_password(client: AsyncClient):
    res = await client.post(REGISTER_URL, json=client_payload(password="123"))
    assert res.status_code == 422


# ─── Login ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient):
    with patch("app.services.auth.send_phone_otp", new_callable=AsyncMock):
        await client.post(REGISTER_URL, json=client_payload(
            email="login_ok@teste.com", phone="34991234572"
        ))
    res = await client.post(LOGIN_URL, json={"email": "login_ok@teste.com", "password": "senha123"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient):
    with patch("app.services.auth.send_phone_otp", new_callable=AsyncMock):
        await client.post(REGISTER_URL, json=client_payload(
            email="wrong_pw@teste.com", phone="34991234573"
        ))
    res = await client.post(LOGIN_URL, json={"email": "wrong_pw@teste.com", "password": "errada"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_login_unknown_email(client: AsyncClient):
    res = await client.post(LOGIN_URL, json={"email": "naoexiste@teste.com", "password": "abc123"})
    assert res.status_code == 401


# ─── Refresh ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_refresh_token_success(client: AsyncClient):
    with patch("app.services.auth.send_phone_otp", new_callable=AsyncMock):
        await client.post(REGISTER_URL, json=client_payload(
            email="refresh@teste.com", phone="34991234574"
        ))
    login_res = await client.post(LOGIN_URL, json={"email": "refresh@teste.com", "password": "senha123"})
    refresh_token = login_res.json()["refresh_token"]

    res = await client.post(REFRESH_URL, json={"refresh_token": refresh_token})
    assert res.status_code == 200
    assert "access_token" in res.json()


@pytest.mark.asyncio
async def test_refresh_invalid_token(client: AsyncClient):
    res = await client.post(REFRESH_URL, json={"refresh_token": "token.invalido.aqui"})
    assert res.status_code == 401


# ─── Protected route ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_me_authenticated(client: AsyncClient):
    with patch("app.services.auth.send_phone_otp", new_callable=AsyncMock):
        await client.post(REGISTER_URL, json=client_payload(
            email="me@teste.com", phone="34991234575"
        ))
    login_res = await client.post(LOGIN_URL, json={"email": "me@teste.com", "password": "senha123"})
    token = login_res.json()["access_token"]

    res = await client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == "me@teste.com"


@pytest.mark.asyncio
async def test_get_me_unauthenticated(client: AsyncClient):
    res = await client.get(ME_URL)
    assert res.status_code == 403
