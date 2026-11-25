import asyncio
from datetime import timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.authz import hash_secret
from app.database import get_db
from app.main import app
from app.models import AppSession, Base, Permission, Role, User, utcnow


@pytest.fixture
def database():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, expire_on_commit=False)

    def override_db():
        with TestingSession() as db:
            yield db

    app.dependency_overrides.clear()
    app.dependency_overrides[get_db] = override_db
    yield TestingSession
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)
    engine.dispose()


def make_identity(TestingSession, role_name: str, permissions: list[str], *, active=True, expired=False, revoked=False, mfa=False):
    raw_session = f"session-secret-for-{role_name}"
    csrf = f"csrf-secret-for-{role_name}"
    with TestingSession.begin() as db:
        role = Role(id=f"role-{role_name}", name=role_name, description=role_name)
        for permission_name in permissions:
            permission = db.scalar(select(Permission).where(Permission.name == permission_name))
            if permission is None:
                permission = Permission(id=f"permission-{permission_name}", name=permission_name, description=permission_name)
            role.permissions.append(permission)
        user = User(id=f"user-{role_name}", idp_subject=f"idp-subject-{role_name}", email=f"{role_name.casefold()}@example.invalid", display_name="Test Person", is_active=active, email_verified=True, mfa_last_verified_at=utcnow() if mfa else None)
        user.roles.append(role)
        session = AppSession(id=f"session-{role_name}", token_hash=hash_secret(raw_session), csrf_hash=hash_secret(csrf), user_id=user.id, expires_at=utcnow() + timedelta(minutes=-1 if expired else 20), revoked_at=utcnow() if revoked else None)
        db.add_all([role, user, session])
    return raw_session, csrf


async def request(method: str, path: str, *, cookie: str | None = None, csrf: str | None = None, json=None):
    headers = {}
    if csrf:
        headers["X-CSRF-Token"] = csrf
    cookies = {}
    if cookie:
        cookies["bg_session"] = cookie
    if csrf:
        cookies["bg_csrf"] = csrf
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver", cookies=cookies) as client:
        return await client.request(method, path, headers=headers, json=json)


def test_catalog_api_rejects_anonymous_request(database):
    response = asyncio.run(request("GET", "/vendors"))
    assert response.status_code == 401


def test_expired_and_revoked_sessions_are_rejected(database):
    expired, _ = make_identity(database, "CEO", ["financial:read"], expired=True)
    assert asyncio.run(request("GET", "/vendors", cookie=expired)).status_code == 401
    revoked, _ = make_identity(database, "Auditor", ["financial:read"], revoked=True)
    assert asyncio.run(request("GET", "/vendors", cookie=revoked)).status_code == 401
    disabled, _ = make_identity(database, "Finance", ["financial:read"], active=False)
    assert asyncio.run(request("GET", "/vendors", cookie=disabled)).status_code == 401


def test_admin_cannot_read_financial_catalog_and_finance_cannot_manage_users(database):
    admin_session, _ = make_identity(database, "Administrator", ["users:manage", "security:read"])
    assert asyncio.run(request("GET", "/vendors", cookie=admin_session)).status_code == 403
    finance_session, _ = make_identity(database, "Finance", ["financial:read"])
    assert asyncio.run(request("GET", "/admin/users", cookie=finance_session)).status_code == 403


def test_administrator_can_access_user_management(database):
    admin_session, _ = make_identity(database, "Administrator", ["users:manage"])
    response = asyncio.run(request("GET", "/admin/users", cookie=admin_session))
    assert response.status_code == 200
    assert response.json()[0]["email"] == "administrator@example.invalid"


def test_administrator_cannot_assign_ceo_or_change_own_role(database):
    admin_session, csrf = make_identity(database, "Administrator", ["users:manage"], mfa=True)
    response = asyncio.run(request("PUT", "/admin/users/user-Administrator/roles", cookie=admin_session, csrf=csrf, json={"roles": ["CEO"]}))
    assert response.status_code == 422
    self_change = asyncio.run(request("PUT", "/admin/users/user-Administrator/roles", cookie=admin_session, csrf=csrf, json={"roles": ["Finance"]}))
    assert self_change.status_code == 403


def test_logout_requires_csrf_and_revokes_the_session(database):
    raw_session, csrf = make_identity(database, "CEO", ["financial:read"])
    denied = asyncio.run(request("POST", "/auth/logout", cookie=raw_session))
    assert denied.status_code == 403
    success = asyncio.run(request("POST", "/auth/logout", cookie=raw_session, csrf=csrf))
    assert success.status_code == 200
    assert asyncio.run(request("GET", "/vendors", cookie=raw_session)).status_code == 401


def test_login_is_closed_when_oidc_is_not_configured():
    response = asyncio.run(request("GET", "/auth/login"))
    assert response.status_code == 503
    assert "password" not in response.text.casefold()


def test_security_denials_are_recorded_and_audit_chain_verifies(database):
    admin_session, _ = make_identity(database, "Administrator", ["users:manage"])
    assert asyncio.run(request("GET", "/vendors", cookie=admin_session)).status_code == 403
    auditor_session, _ = make_identity(database, "Auditor", ["audit:read"])
    response = asyncio.run(request("GET", "/audit/integrity", cookie=auditor_session))
    assert response.status_code == 200
    assert response.json()["valid"] is True
    assert response.json()["verified_events"] == 1
