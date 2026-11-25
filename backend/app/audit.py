import hashlib
import json
from datetime import timezone

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AuditEvent, AuditHead, SecurityEvent, utcnow


def _iso_utc(value):
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def verify_chain(db: Session) -> tuple[bool, int]:
    rows = db.scalars(select(AuditEvent).order_by(AuditEvent.occurred_at, AuditEvent.id)).all()
    previous = "0" * 64
    for row in rows:
        payload = {
            "occurred_at": _iso_utc(row.occurred_at),
            "event_type": row.event_type,
            "actor_user_id": row.actor_user_id,
            "resource_type": row.resource_type,
            "resource_id": row.resource_id,
            "result": row.result,
            "correlation_id": row.correlation_id,
            "details": row.details or {},
        }
        digest = hashlib.sha256((previous + json.dumps(payload, sort_keys=True, separators=(",", ":"))).encode()).hexdigest()
        if row.previous_hash != previous or row.event_hash != digest:
            return False, len(rows)
        previous = row.event_hash
    head = db.get(AuditHead, 1)
    return bool(head and head.last_hash == previous), len(rows)


def record_event(
    db: Session,
    request: Request | None,
    event_type: str,
    result: str,
    *,
    actor_user_id: str | None = None,
    resource_type: str = "system",
    resource_id: str | None = None,
    details: dict | None = None,
    security: bool = True,
) -> AuditEvent:
    occurred = utcnow()
    correlation_id = getattr(request.state, "correlation_id", "unknown") if request else "system-operation"
    payload = {
        "occurred_at": _iso_utc(occurred),
        "event_type": event_type,
        "actor_user_id": actor_user_id,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "result": result,
        "correlation_id": correlation_id,
        "details": details or {},
    }
    head = db.scalar(select(AuditHead).where(AuditHead.id == 1).with_for_update())
    previous = head.last_hash if head else "0" * 64
    event_hash = hashlib.sha256((previous + json.dumps(payload, sort_keys=True, separators=(",", ":"))).encode()).hexdigest()
    event = AuditEvent(
        occurred_at=occurred,
        event_type=event_type,
        actor_user_id=actor_user_id,
        resource_type=resource_type,
        resource_id=resource_id,
        result=result,
        correlation_id=correlation_id,
        details=details or {},
        previous_hash=previous,
        event_hash=event_hash,
    )
    db.add(event)
    if security:
        db.add(SecurityEvent(
            occurred_at=occurred,
            event_type=event_type,
            actor_user_id=actor_user_id,
            resource_id=resource_id,
            result=result,
            correlation_id=correlation_id,
            details=details or {},
        ))
    if head:
        head.last_hash = event_hash
    else:
        db.add(AuditHead(id=1, last_hash=event_hash))
    return event
