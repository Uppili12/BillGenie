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
    assert response.headers.get("x-request-id")
    assert response.headers.get("x-content-type-options") == "nosniff"


def test_readiness_fails_when_database_is_unavailable(monkeypatch):
    from app import database
    monkeypatch.setattr(database, "readiness", lambda: False)
    async def request():
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
            return await client.get("/ready")

    response = asyncio.run(request())
    assert response.status_code == 503
    assert response.json() == {"status": "degraded"}


def test_rejects_oversized_declared_body():
    async def request():
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
            return await client.post("/health", headers={"content-length": "1048577"})

    response = asyncio.run(request())
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "request_too_large"


def test_health_rejects_post():
    assert asyncio.run(request_health("POST")).status_code == 405
