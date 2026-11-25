import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated
from urllib.parse import urlencode
from uuid import uuid4

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .audit import record_event
from .authz import Principal, current_principal, hash_secret
from .database import get_db
from .models import AppSession, Invitation, MfaEnrollment, Role, User, utcnow

logger = logging.getLogger("billgenie.auth")
router = APIRouter(prefix="/auth", tags=["authentication"])
oauth = OAuth()
issuer = os.getenv("OIDC_ISSUER", "").rstrip("/")
client_id = os.getenv("OIDC_CLIENT_ID", "")
redirect_uri = os.getenv("OIDC_REDIRECT_URI", "http://127.0.0.1:8000/auth/callback")
frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://127.0.0.1:3000").rstrip("/")
cookie_secure = os.getenv("BILLGENIE_COOKIE_SECURE", "0") == "1"
session_cookie_name = "__Host-bg_session" if cookie_secure else "bg_session"
oidc_ready = bool(issuer and client_id and redirect_uri)
if os.getenv("BILLGENIE_ENVIRONMENT", "development").casefold() == "production":
    oidc_ready = oidc_ready and issuer.startswith("https://") and redirect_uri.startswith("https://")
if oidc_ready:
    oauth.register(
        name="identity",
        client_id=client_id,
        client_secret=None,
        server_metadata_url=f"{issuer}/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile", "code_challenge_method": "S256"},
    )


def fail_closed() -> HTTPException:
    return HTTPException(status_code=503, detail="Authentication is temporarily unavailable")


def add_auth_cookies(response: Response, session_secret: str, csrf_secret: str) -> None:
    response.set_cookie(
        session_cookie_name,
        session_secret,
        max_age=1800,
        httponly=True,
        secure=cookie_secure,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        "bg_csrf",
        csrf_secret,
        max_age=1800,
        httponly=False,
        secure=cookie_secure,
        samesite="strict",
        path="/",
    )


def expire_auth_cookies(response: Response) -> None:
    response.delete_cookie(session_cookie_name, path="/", secure=cookie_secure, httponly=True, samesite="lax")
    response.delete_cookie("bg_csrf", path="/", secure=cookie_secure, samesite="strict")


def require_csrf(request: Request, db: Session, session: AppSession) -> None:
    cookie = request.cookies.get("bg_csrf", "")
    header = request.headers.get("x-csrf-token", "")
    if not cookie or not header or not secrets.compare_digest(cookie, header) or not secrets.compare_digest(hash_secret(cookie), session.csrf_hash):
        record_event(db, request, "csrf_rejected", "denied", actor_user_id=session.user_id, resource_type="session", resource_id=session.id)
        db.commit()
        raise HTTPException(status_code=403, detail="Request could not be verified")


@router.get("/login")
async def login(request: Request, invite: str | None = None):
    if not oidc_ready:
        raise fail_closed()
    if invite and len(invite) < 32:
        raise HTTPException(status_code=400, detail="Invitation is invalid")
    if invite:
        request.session["invite_hash"] = hash_secret(invite)
    client = oauth.create_client("identity")
    return await client.authorize_redirect(request, redirect_uri, code_challenge_method="S256")


@router.get("/callback")
async def callback(request: Request, db: Annotated[Session, Depends(get_db)]):
    if not oidc_ready:
        raise fail_closed()
    invite_hash = request.session.get("invite_hash")
    try:
        client = oauth.create_client("identity")
        token = await client.authorize_access_token(request)
        claims = token.get("userinfo")
        if not claims or claims.get("email_verified") is not True or not claims.get("sub") or not claims.get("email"):
            raise ValueError("Required verified identity claims are missing")
        subject = str(claims["sub"])
        email = str(claims["email"]).strip().casefold()
        display_name = str(claims.get("name") or "")[:160]
        methods = claims.get("amr") or []
        mfa_verified = any(value in {"otp", "hwk", "webauthn", "mfa"} for value in methods)

        user = db.scalar(select(User).options(selectinload(User.roles)).where(User.idp_subject == subject))
        invite_row = None
        if invite_hash:
            invite_row = db.scalar(select(Invitation).where(
                Invitation.token_hash == invite_hash,
                Invitation.accepted_at.is_(None),
                Invitation.expires_at > utcnow(),
            ).with_for_update())
            if not invite_row or invite_row.email.casefold() != email:
                raise ValueError("Invitation is not valid for this verified identity")
        if user is None and invite_row is None:
            raise ValueError("User is not invited")
        if user is None and invite_row is not None:
            user = User(idp_subject=subject, email=email, display_name=display_name, email_verified=True, is_active=True)
            user.roles.append(db.get(Role, invite_row.role_id))
            invite_row.accepted_at = utcnow()
            db.add(user)
            db.flush()
            record_event(db, request, "invitation_accepted", "success", actor_user_id=user.id, resource_type="user", resource_id=user.id)
        if not user or not user.is_active:
            raise ValueError("Account is unavailable")

        now = utcnow()
        user.email = email
        user.email_verified = True
        user.display_name = display_name
        user.last_login_at = now
        if mfa_verified:
            user.mfa_last_verified_at = now
            recognized_methods = {"otp": "totp", "hwk": "passkey", "webauthn": "passkey", "mfa": "provider-mfa"}
            for amr_method in set(methods).intersection(recognized_methods):
                method = recognized_methods[amr_method]
                enrollment = db.scalar(select(MfaEnrollment).where(MfaEnrollment.user_id == user.id, MfaEnrollment.provider == "oidc", MfaEnrollment.method == method).with_for_update())
                if enrollment is None:
                    enrollment = MfaEnrollment(user_id=user.id, provider="oidc", method=method, status="active", enrolled_at=now)
                    db.add(enrollment)
                enrollment.last_verified_at = now
        session_secret = secrets.token_urlsafe(32)
        csrf_secret = secrets.token_urlsafe(32)
        app_session = AppSession(
            id=str(uuid4()),
            token_hash=hash_secret(session_secret),
            csrf_hash=hash_secret(csrf_secret),
            user_id=user.id,
            created_at=now,
            expires_at=now + timedelta(minutes=30),
            user_agent_hash=hash_secret(request.headers.get("user-agent", "")[:512]) if request.headers.get("user-agent") else None,
        )
        db.add(app_session)
        record_event(db, request, "login_success", "success", actor_user_id=user.id, resource_type="session", resource_id=app_session.id, details={"mfa_verified": mfa_verified})
        db.commit()
        request.session.clear()
        response = RedirectResponse(f"{frontend_origin}/", status_code=303)
        add_auth_cookies(response, session_secret, csrf_secret)
        return response
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        logger.warning("oidc_callback_failed request_id=%s", getattr(request.state, "correlation_id", "unknown"))
        try:
            record_event(db, request, "login_failure", "denied", resource_type="identity", details={"reason": "identity_provider_or_policy_failure"})
            db.commit()
        except Exception:
            db.rollback()
        request.session.clear()
        return RedirectResponse(f"{frontend_origin}/login?error=signin_failed", status_code=303)


@router.get("/me")
def me(principal: Annotated[Principal, Depends(current_principal)]):
    return {
        "id": principal.user.id,
        "email": principal.user.email,
        "display_name": principal.user.display_name,
        "roles": sorted(principal.roles),
        "mfa_last_verified_at": principal.user.mfa_last_verified_at,
        "mfa_enrolled_methods": [item.method for item in principal.user.mfa_enrollments if item.status == "active"],
        "last_login_at": principal.user.last_login_at,
    }


@router.get("/sessions")
def list_sessions(request: Request, db: Annotated[Session, Depends(get_db)], principal: Annotated[Principal, Depends(current_principal)]):
    current = request.cookies.get(session_cookie_name, "")
    rows = db.scalars(select(AppSession).where(
        AppSession.user_id == principal.user.id,
        AppSession.revoked_at.is_(None),
        AppSession.expires_at > utcnow(),
    ).order_by(AppSession.created_at.desc())).all()
    return [{"id": row.id, "created_at": row.created_at, "expires_at": row.expires_at, "current": secrets.compare_digest(row.token_hash, hash_secret(current))} for row in rows]


@router.get("/history")
def login_history(db: Annotated[Session, Depends(get_db)], principal: Annotated[Principal, Depends(current_principal)]):
    from .models import SecurityEvent
    rows = db.scalars(select(SecurityEvent).where(SecurityEvent.actor_user_id == principal.user.id).order_by(SecurityEvent.occurred_at.desc()).limit(50)).all()
    return [{"occurred_at": row.occurred_at, "event_type": row.event_type, "result": row.result, "correlation_id": row.correlation_id} for row in rows]


@router.post("/logout")
def logout(request: Request, response: Response, db: Annotated[Session, Depends(get_db)], principal: Annotated[Principal, Depends(current_principal)]):
    current = request.cookies.get(session_cookie_name, "")
    app_session = db.scalar(select(AppSession).where(AppSession.token_hash == hash_secret(current), AppSession.user_id == principal.user.id, AppSession.revoked_at.is_(None)))
    if not app_session:
        raise HTTPException(status_code=401, detail="Authentication required")
    require_csrf(request, db, app_session)
    app_session.revoked_at = utcnow()
    record_event(db, request, "logout", "success", actor_user_id=principal.user.id, resource_type="session", resource_id=app_session.id)
    db.commit()
    expire_auth_cookies(response)
    return {"status": "ok", "logout_url": identity_logout_url()}


@router.post("/logout-all")
def logout_all(request: Request, response: Response, db: Annotated[Session, Depends(get_db)], principal: Annotated[Principal, Depends(current_principal)]):
    current = request.cookies.get(session_cookie_name, "")
    app_session = db.scalar(select(AppSession).where(AppSession.token_hash == hash_secret(current), AppSession.user_id == principal.user.id, AppSession.revoked_at.is_(None)))
    if not app_session:
        raise HTTPException(status_code=401, detail="Authentication required")
    require_csrf(request, db, app_session)
    db.query(AppSession).filter(AppSession.user_id == principal.user.id, AppSession.revoked_at.is_(None)).update({"revoked_at": utcnow()}, synchronize_session=False)
    record_event(db, request, "sessions_revoked", "success", actor_user_id=principal.user.id, resource_type="user", resource_id=principal.user.id)
    db.commit()
    expire_auth_cookies(response)
    return {"status": "ok", "logout_url": identity_logout_url()}


def identity_logout_url() -> str:
    if not oidc_ready:
        return f"{frontend_origin}/login"
    import secrets as _secrets
    return f"{issuer}/protocol/openid-connect/logout?{urlencode({'client_id': client_id, 'post_logout_redirect_uri': f'{frontend_origin}/login', 'state': _secrets.token_urlsafe(24)})}"
