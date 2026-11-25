from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from typing import Annotated, Callable

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .audit import record_event
from .database import get_db
from .models import AppSession, User


@dataclass(frozen=True)
class Principal:
    user: User
    roles: frozenset[str]
    permissions: frozenset[str]


def hash_secret(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()


def record_unauthorized(db: Session, request: Request, actor_user_id: str | None, reason: str) -> None:
    try:
        record_event(db, request, "unauthorized_access", "denied", actor_user_id=actor_user_id, resource_type="api", resource_id=request.url.path, details={"reason": reason})
        db.commit()
    except Exception:
        db.rollback()


def current_principal(request: Request, db: Annotated[Session, Depends(get_db)]) -> Principal:
    session_secret = request.cookies.get("__Host-bg_session") or request.cookies.get("bg_session")
    if not session_secret:
        record_unauthorized(db, request, None, "session_missing")
        raise HTTPException(status_code=401, detail="Authentication required")
    app_session = db.scalar(select(AppSession).where(
        AppSession.token_hash == hash_secret(session_secret),
        AppSession.revoked_at.is_(None),
        AppSession.expires_at > datetime.now(timezone.utc),
    ))
    if not app_session:
        record_unauthorized(db, request, None, "session_expired_or_revoked")
        raise HTTPException(status_code=401, detail="Authentication required")
    user = db.get(User, app_session.user_id)
    if not user or not user.is_active or not user.email_verified:
        record_unauthorized(db, request, user.id if user else None, "account_not_authorized")
        raise HTTPException(status_code=401, detail="Authentication required")
    permissions = frozenset(permission.name for role in user.roles for permission in role.permissions)
    return Principal(user=user, roles=frozenset(role.name for role in user.roles), permissions=permissions)


def require_permissions(*permissions: str) -> Callable:
    def dependency(request: Request, db: Annotated[Session, Depends(get_db)], principal: Annotated[Principal, Depends(current_principal)]) -> Principal:
        if not set(permissions).issubset(principal.permissions):
            record_unauthorized(db, request, principal.user.id, "permission_denied")
            raise HTTPException(status_code=403, detail="Access denied")
        return principal
    return dependency


FinancialReader = Annotated[Principal, Depends(require_permissions("financial:read"))]
