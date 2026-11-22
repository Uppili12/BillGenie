import asyncio

from httpx import ASGITransport, AsyncClient

from app.main import app


async def request_health(method: str):
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        return await client.request(method, "/health")


def test_health_returns_json_liveness():
    response = asyncio.run(request_health("GET"))

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {"status": "ok"}


def test_health_rejects_post():
    assert asyncio.run(request_health("POST")).status_code == 405
