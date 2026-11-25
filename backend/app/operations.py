"""Privileged, local-only identity bootstrap and CEO assignment operations."""
import argparse
import os
import re
import secrets
from datetime import timedelta

from sqlalchemy import select

from .audit import record_event
from .authz import hash_secret
from .database import SessionLocal
from .models import Invitation, Role, User, utcnow


def bootstrap_admin_invite(email: str, change_id: str) -> None:
    normalized = email.strip().casefold()
    token = secrets.token_urlsafe(32)
    with SessionLocal.begin() as db:
        if db.scalar(select(User.id).where(User.email == normalized)):
            raise SystemExit("An account already exists for that address.")
        role = db.scalar(select(Role).where(Role.name == "Administrator"))
        if not role:
            raise SystemExit("Role metadata is missing; apply Alembic migrations first.")
        invitation = Invitation(email=normalized, role_id=role.id, token_hash=hash_secret(token), invited_by=None, expires_at=utcnow() + timedelta(hours=24))
        db.add(invitation)
        db.flush()
        record_event(db, None, "user_invited", "success", resource_type="invitation", resource_id=invitation.id, details={"role": "Administrator", "change_id": change_id})
    print(f"One-time local invitation URL (deliver through an approved channel): {os.getenv('FRONTEND_ORIGIN', 'http://127.0.0.1:3000')}/login?invite={token}")


def assign_ceo(email: str, approved_by: str, change_id: str) -> None:
    with SessionLocal.begin() as db:
        user = db.scalar(select(User).where(User.email == email.strip().casefold()).with_for_update())
        approver = db.scalar(select(User).where(User.email == approved_by.strip().casefold()).with_for_update())
        ceo_role = db.scalar(select(Role).where(Role.name == "CEO"))
        if not user or not user.email_verified or not user.is_active or not ceo_role:
            raise SystemExit("The target must be an active account with a verified email.")
        if not approver or "CEO" not in {role.name for role in approver.roles} or not approver.mfa_last_verified_at:
            raise SystemExit("CEO role changes require approval from an active CEO with a recorded MFA verification.")
        if any(role.name == "Administrator" for role in user.roles):
            raise SystemExit("An administrator account cannot be assigned the CEO role.")
        user.roles = [ceo_role]
        record_event(db, None, "user_roles_changed", "success", actor_user_id=approver.id, resource_type="user", resource_id=user.id, details={"new_roles": ["CEO"], "change_id": change_id, "assignment_channel": "privileged_operator"})


def bootstrap_first_ceo(email: str, change_id: str) -> None:
    approved_subject = os.getenv("BILLGENIE_INITIAL_CEO_SUBJECT", "")
    approved_change = os.getenv("BILLGENIE_INITIAL_CEO_CHANGE_ID", "")
    if not approved_subject or not approved_change or not secrets.compare_digest(change_id, approved_change):
        raise SystemExit("First CEO assignment requires matching, separately approved deployment settings.")
    with SessionLocal.begin() as db:
        user = db.scalar(select(User).where(User.email == email.strip().casefold()).with_for_update())
        ceo_role = db.scalar(select(Role).where(Role.name == "CEO"))
        if not user or user.idp_subject != approved_subject or not user.is_active or not user.email_verified or not user.mfa_last_verified_at:
            raise SystemExit("Target must match the approved subject and have verified email, active status, and recorded MFA.")
        if any(role.name == "Administrator" for role in user.roles) or db.scalar(select(User.id).join(User.roles).where(Role.name == "CEO")):
            raise SystemExit("A CEO already exists or the target holds the Administrator role.")
        if not ceo_role:
            raise SystemExit("Role metadata is missing; apply Alembic migrations first.")
        user.roles = [ceo_role]
        record_event(db, None, "user_roles_changed", "success", resource_type="user", resource_id=user.id, details={"new_roles": ["CEO"], "change_id": change_id, "assignment_channel": "separately_approved_bootstrap"})


def main() -> None:
    parser = argparse.ArgumentParser(description="Privileged BillGenie identity operations")
    sub = parser.add_subparsers(dest="command", required=True)
    invite = sub.add_parser("bootstrap-admin-invite", help="Issue the first short-lived administrator invite")
    invite.add_argument("email")
    invite.add_argument("--change-id", required=True)
    ceo = sub.add_parser("assign-ceo", help="Assign CEO only with approval from an existing MFA-verified CEO")
    ceo.add_argument("email")
    ceo.add_argument("--approved-by", required=True)
    ceo.add_argument("--change-id", required=True)
    first_ceo = sub.add_parser("bootstrap-first-ceo", help="One-time initial CEO assignment using separately approved deployment settings")
    first_ceo.add_argument("email")
    first_ceo.add_argument("--change-id", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9._/-]{1,80}", args.change_id.strip()):
        parser.error("A valid change ID is required")
    if args.command == "bootstrap-admin-invite":
        bootstrap_admin_invite(args.email, args.change_id)
    elif args.command == "assign-ceo":
        assign_ceo(args.email, args.approved_by, args.change_id)
    else:
        bootstrap_first_ceo(args.email, args.change_id)


if __name__ == "__main__":
    main()
