import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "frete-facil-api"


@pytest.mark.asyncio
async def test_health_check_no_db(client: AsyncClient):
    """Basic health endpoint must respond even without DB/Redis."""
    response = await client.get("/health")
    assert response.status_code == 200
