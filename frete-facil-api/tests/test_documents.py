import pytest
import io
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock

from tests.test_auth import REGISTER_URL, LOGIN_URL

DOCUMENTS_URL = "/api/v1/driver/documents"
VERIFY_STATUS_URL = "/api/v1/driver/verification-status"
UPLOAD_FILE_URL = "/api/v1/uploads/file"
ADMIN_PENDING_URL = "/api/v1/admin/drivers/pending"
ADMIN_DRIVERS_URL = "/api/v1/admin/drivers"
VEHICLES_URL = "/api/v1/users/me/vehicles"


async def _register_driver(client: AsyncClient, email: str, phone: str) -> str:
    with patch("app.services.auth.send_phone_otp", new_callable=AsyncMock):
        await client.post(REGISTER_URL, json={
            "name": "Carlos Motorista",
            "email": email,
            "phone": phone,
            "password": "senha123",
            "role": "driver",
        })
    res = await client.post(LOGIN_URL, json={"email": email, "password": "senha123"})
    return res.json()["access_token"]


async def _register_client(client: AsyncClient, email: str, phone: str) -> str:
    with patch("app.services.auth.send_phone_otp", new_callable=AsyncMock):
        await client.post(REGISTER_URL, json={
            "name": "Ana Cliente",
            "email": email,
            "phone": phone,
            "password": "senha123",
            "role": "client",
        })
    res = await client.post(LOGIN_URL, json={"email": email, "password": "senha123"})
    return res.json()["access_token"]


# ─── Upload ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_upload_file_direct(client: AsyncClient):
    token = await _register_driver(client, "upload_driver@t.com", "34991110001")
    fake_image = io.BytesIO(b"\xff\xd8\xff" + b"\x00" * 100)  # minimal JPEG header
    res = await client.post(
        UPLOAD_FILE_URL,
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("cnh_frente.jpg", fake_image, "image/jpeg")},
        data={"folder": "cnh"},
    )
    assert res.status_code == 201
    assert "url" in res.json()
    assert "cnh/" in res.json()["url"]


@pytest.mark.asyncio
async def test_upload_invalid_folder(client: AsyncClient):
    token = await _register_driver(client, "upload_bad_folder@t.com", "34991110002")
    fake_image = io.BytesIO(b"\xff\xd8\xff" + b"\x00" * 100)
    res = await client.post(
        UPLOAD_FILE_URL,
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("file.jpg", fake_image, "image/jpeg")},
        data={"folder": "hacker"},
    )
    assert res.status_code == 400


# ─── Documents update ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_documents_success(client: AsyncClient):
    token = await _register_driver(client, "doc_update@t.com", "34991110003")
    res = await client.patch(
        DOCUMENTS_URL,
        headers={"Authorization": f"Bearer {token}"},
        json={
            "cnh_number": "12345678901",
            "cnh_front_url": "http://localhost:8000/uploads/cnh/abc.jpg",
            "cnh_back_url": "http://localhost:8000/uploads/cnh/def.jpg",
            "selfie_url": "http://localhost:8000/uploads/selfie/ghi.jpg",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["cnh_number"] == "12345678901"
    assert data["verification_status"] == "pending"


@pytest.mark.asyncio
async def test_client_cannot_update_documents(client: AsyncClient):
    token = await _register_client(client, "client_nodocs@t.com", "34991110004")
    res = await client.patch(
        DOCUMENTS_URL,
        headers={"Authorization": f"Bearer {token}"},
        json={"cnh_number": "99999999999"},
    )
    assert res.status_code == 403


# ─── Verification status ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_verification_status_missing_docs(client: AsyncClient):
    token = await _register_driver(client, "status_missing@t.com", "34991110005")
    res = await client.get(
        VERIFY_STATUS_URL,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_complete"] is False
    assert len(data["missing_documents"]) > 0
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_verification_status_complete(client: AsyncClient):
    token = await _register_driver(client, "status_full@t.com", "34991110006")
    await client.patch(
        DOCUMENTS_URL,
        headers={"Authorization": f"Bearer {token}"},
        json={
            "cnh_number": "12345678902",
            "cnh_front_url": "http://r2.dev/cnh/a.jpg",
            "cnh_back_url": "http://r2.dev/cnh/b.jpg",
            "selfie_url": "http://r2.dev/selfie/c.jpg",
        },
    )
    res = await client.get(VERIFY_STATUS_URL, headers={"Authorization": f"Bearer {token}"})
    assert res.json()["is_complete"] is True
    assert res.json()["missing_documents"] == []


# ─── Vehicle ─────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_vehicle_success(client: AsyncClient):
    token = await _register_driver(client, "vehicle_add@t.com", "34991110007")
    res = await client.post(
        VEHICLES_URL,
        headers={"Authorization": f"Bearer {token}"},
        json={
            "type": "caminhonete",
            "plate": "ABC1234",
            "brand": "Fiat",
            "model": "Strada",
            "year": 2022,
            "capacity_kg": 800,
            "color": "Prata",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["plate"] == "ABC1234"
    assert data["type"] == "caminhonete"


@pytest.mark.asyncio
async def test_add_vehicle_duplicate_plate(client: AsyncClient):
    token = await _register_driver(client, "vehicle_dup@t.com", "34991110008")
    payload = {"type": "furgao", "plate": "DUP1111", "brand": "VW", "model": "Kombi", "year": 2010}
    await client.post(VEHICLES_URL, headers={"Authorization": f"Bearer {token}"}, json=payload)
    res = await client.post(VEHICLES_URL, headers={"Authorization": f"Bearer {token}"}, json=payload)
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_client_cannot_add_vehicle(client: AsyncClient):
    token = await _register_client(client, "client_novehicle@t.com", "34991110009")
    res = await client.post(
        VEHICLES_URL,
        headers={"Authorization": f"Bearer {token}"},
        json={"type": "furgao", "plate": "CLT0000", "brand": "X", "model": "Y", "year": 2020},
    )
    assert res.status_code == 403


# ─── Admin ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_list_pending_drivers(client: AsyncClient):
    token = await _register_driver(client, "admin_test_driver@t.com", "34991110010")
    admin_token = await _register_client(client, "admin_user@t.com", "34991110011")

    res = await client.get(
        ADMIN_PENDING_URL,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_admin_approve_driver(client: AsyncClient):
    token = await _register_driver(client, "approve_driver@t.com", "34991110012")
    admin_token = await _register_client(client, "approver_admin@t.com", "34991110013")

    # Get driver profile id
    me_res = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    driver_profile_id = me_res.json()["driver_profile"]["id"]

    res = await client.patch(
        f"/api/v1/admin/drivers/{driver_profile_id}/verify",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "approved"},
    )
    assert res.status_code == 200
    assert res.json()["verification_status"] == "approved"


@pytest.mark.asyncio
async def test_admin_reject_driver_requires_reason(client: AsyncClient):
    token = await _register_driver(client, "reject_driver@t.com", "34991110014")
    admin_token = await _register_client(client, "rejecter_admin@t.com", "34991110015")

    me_res = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    driver_profile_id = me_res.json()["driver_profile"]["id"]

    res = await client.patch(
        f"/api/v1/admin/drivers/{driver_profile_id}/verify",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "rejected"},  # no reason
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_admin_reject_driver_with_reason(client: AsyncClient):
    token = await _register_driver(client, "reject2_driver@t.com", "34991110016")
    admin_token = await _register_client(client, "rejecter2_admin@t.com", "34991110017")

    me_res = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    driver_profile_id = me_res.json()["driver_profile"]["id"]

    res = await client.patch(
        f"/api/v1/admin/drivers/{driver_profile_id}/verify",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "rejected", "rejection_reason": "CNH ilegível"},
    )
    assert res.status_code == 200
    assert res.json()["verification_status"] == "rejected"
