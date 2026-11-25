import secrets
from datetime import timedelta
from typing import Annotated, Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .audit import record_event, verify_chain
from .auth import frontend_origin, require_csrf, session_cookie_name
from .authz import Principal, current_principal, hash_secret, require_permissions
from .database import get_db
from .models import AppSession, AuditEvent, Invitation, Role, SecurityEvent, User, as_utc, utcnow

router = APIRouter(tags=["identity administration"])
Admin = Annotated[Principal, Depends(require_permissions("users:manage"))]
Auditor = Annotated[Principal, Depends(require_permissions("audit:read"))]
SecurityReader = Annotated[Principal, Depends(require_permissions("security:read"))]
AllowedInviteRole = Literal["Finance", "Administrator", "Auditor"]


class InvitationInput(BaseModel):
    email: EmailStr
    role: AllowedInviteRole


class ActivationInput(BaseModel):
    is_active: bool


class RoleInput(BaseModel):
    roles: list[Literal["Finance", "Administrator", "Auditor"]] = Field(min_length=1, max_length=3)


def actor_session(request: Request, db: Session, actor: Principal) -> AppSession:
    raw = request.cookies.get(session_cookie_name, "")
    app_session = db.scalar(select(AppSession).where(
        AppSession.token_hash == hash_secret(raw),
        AppSession.user_id == actor.user.id,
        AppSession.revoked_at.is_(None),
        AppSession.expires_at > utcnow(),
    ))
    if not app_session:
        raise HTTPException(status_code=401, detail="Authentication required")
    require_csrf(request, db, app_session)
    recent_auth = utcnow() - timedelta(minutes=5)
    if as_utc(app_session.created_at) < recent_auth or actor.user.mfa_last_verified_at is None or as_utc(actor.user.mfa_last_verified_at) < recent_auth:
        raise HTTPException(status_code=403, detail="Fresh multi-factor authentication is required")
    return app_session


@router.post("/admin/invitations", status_code=201)
def invite_user(payload: InvitationInput, request: Request, db: Annotated[Session, Depends(get_db)], actor: Admin):
    actor_session(request, db, actor)
    email = str(payload.email).strip().casefold()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Invitation could not be created")
    role = db.scalar(select(Role).where(Role.name == payload.role))
    if not role:
        raise HTTPException(status_code=503, detail="Role configuration is unavailable")
    token = secrets.token_urlsafe(32)
    invitation = Invitation(
        email=email,
        role_id=role.id,
        token_hash=hash_secret(token),
        invited_by=actor.user.id,
        expires_at=utcnow() + timedelta(hours=24),
    )
    db.add(invitation)
    db.flush()
    record_event(db, request, "user_invited", "success", actor_user_id=actor.user.id, resource_type="invitation", resource_id=invitation.id, details={"role": payload.role})
    db.commit()
    return {"id": invitation.id, "role": payload.role, "expires_at": invitation.expires_at, "invite_url": f"{frontend_origin}/login?invite={quote(token)}"}


@router.get("/admin/users")
def list_users(db: Annotated[Session, Depends(get_db)], _: Admin):
    users = db.scalars(select(User).options(selectinload(User.mfa_enrollments)).order_by(User.email)).all()
    return [{
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "roles": sorted(role.name for role in user.roles),
        "is_active": user.is_active,
        "email_verified": user.email_verified,
        "mfa_last_verified_at": user.mfa_last_verified_at,
        "mfa_enrolled_methods": [item.method for item in user.mfa_enrollments if item.status == "active"],
        "last_login_at": user.last_login_at,
    } for user in users]


@router.patch("/admin/users/{user_id}/status")
def set_user_status(user_id: str, payload: ActivationInput, request: Request, db: Annotated[Session, Depends(get_db)], actor: Admin):
    actor_session(request, db, actor)
    if user_id == actor.user.id:
        raise HTTPException(status_code=403, detail="Access denied")
        user = db.scalar(select(User).options(selectinload(User.roles)).where(User.id == user_id).with_for_update())
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = payload.is_active
    if not payload.is_active:
        db.query(AppSession).filter(AppSession.user_id == user.id, AppSession.revoked_at.is_(None)).update({"revoked_at": utcnow()}, synchronize_session=False)
    record_event(db, request, "user_activated" if payload.is_active else "user_deactivated", "success", actor_user_id=actor.user.id, resource_type="user", resource_id=user.id)
    db.commit()
    return {"id": user.id, "is_active": user.is_active}


@router.put("/admin/users/{user_id}/roles")
def set_user_roles(user_id: str, payload: RoleInput, request: Request, db: Annotated[Session, Depends(get_db)], actor: Admin):
    actor_session(request, db, actor)
    if user_id == actor.user.id:
        raise HTTPException(status_code=403, detail="Access denied")
        user = db.scalar(select(User).options(selectinload(User.roles)).where(User.id == user_id).with_for_update())
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if any(role.name == "CEO" for role in user.roles):
        raise HTTPException(status_code=403, detail="CEO role changes require the separately authorized process")
    roles = db.scalars(select(Role).where(Role.name.in_(payload.roles))).all()
    if len(roles) != len(set(payload.roles)):
        raise HTTPException(status_code=422, detail="Invalid role assignment")
    old_roles = sorted(role.name for role in user.roles)
    user.roles = list(roles)
    record_event(db, request, "user_roles_changed", "success", actor_user_id=actor.user.id, resource_type="user", resource_id=user.id, details={"old_roles": old_roles, "new_roles": sorted(payload.roles)})
    db.commit()
    return {"id": user.id, "roles": sorted(role.name for role in user.roles)}


@router.get("/admin/users/{user_id}/sessions")
def list_user_sessions(user_id: str, db: Annotated[Session, Depends(get_db)], _: Admin):
    if not db.get(User, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    sessions = db.scalars(select(AppSession).where(AppSession.user_id == user_id, AppSession.revoked_at.is_(None), AppSession.expires_at > utcnow()).order_by(AppSession.created_at.desc())).all()
    return [{"id": item.id, "created_at": item.created_at, "expires_at": item.expires_at} for item in sessions]


@router.delete("/admin/sessions/{session_id}", status_code=204)
def revoke_session(session_id: str, request: Request, db: Annotated[Session, Depends(get_db)], actor: Admin):
    actor_session(request, db, actor)
    item = db.scalar(select(AppSession).where(AppSession.id == session_id).with_for_update())
    if not item:
        raise HTTPException(status_code=404, detail="Session not found")
    item.revoked_at = utcnow()
    record_event(db, request, "session_revoked", "success", actor_user_id=actor.user.id, resource_type="session", resource_id=item.id)
    db.commit()


@router.get("/security/events")
def security_events(db: Annotated[Session, Depends(get_db)], _: SecurityReader, limit: int = 50):
    limit = max(1, min(limit, 200))
    rows = db.scalars(select(SecurityEvent).order_by(SecurityEvent.occurred_at.desc()).limit(limit)).all()
    since = utcnow() - timedelta(days=1)
    return {
        "summary": {
            "successful_logins_24h": db.scalar(select(func.count()).select_from(SecurityEvent).where(SecurityEvent.event_type == "login_success", SecurityEvent.occurred_at >= since)) or 0,
            "failed_logins_24h": db.scalar(select(func.count()).select_from(SecurityEvent).where(SecurityEvent.event_type == "login_failure", SecurityEvent.occurred_at >= since)) or 0,
            "denied_requests_24h": db.scalar(select(func.count()).select_from(SecurityEvent).where(SecurityEvent.result == "denied", SecurityEvent.occurred_at >= since)) or 0,
            "active_sessions": db.scalar(select(func.count()).select_from(AppSession).where(AppSession.revoked_at.is_(None), AppSession.expires_at > utcnow())) or 0,
        },
        "events": [{"id": row.id, "occurred_at": row.occurred_at, "event_type": row.event_type, "actor_user_id": row.actor_user_id, "resource_id": row.resource_id, "result": row.result, "correlation_id": row.correlation_id, "details": row.details} for row in rows],
    }


@router.get("/audit/events")
def audit_events(db: Annotated[Session, Depends(get_db)], _: Auditor, limit: int = 100):
    limit = max(1, min(limit, 500))
    rows = db.scalars(select(AuditEvent).order_by(AuditEvent.occurred_at.desc()).limit(limit)).all()
    return [{"id": row.id, "occurred_at": row.occurred_at, "event_type": row.event_type, "actor_user_id": row.actor_user_id, "resource_type": row.resource_type, "resource_id": row.resource_id, "result": row.result, "correlation_id": row.correlation_id, "event_hash": row.event_hash} for row in rows]


@router.get("/audit/integrity")
def audit_integrity(db: Annotated[Session, Depends(get_db)], _: Auditor):
    valid, count = verify_chain(db)
    return {"valid": valid, "verified_events": count}
