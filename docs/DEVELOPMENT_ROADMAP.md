# Development roadmap

## Phase 1 — read-only foundation

Synthetic invoice, subscription, and vendor records are shown in a responsive dashboard. The catalog remains read-only. Payments, production ERPNext, and external financial systems are disconnected.

## Phase 2 — identity and security foundation

The repository includes OIDC/PKCE sign-in against a development Keycloak realm, PostgreSQL user/role/permission/session/audit models, Alembic migrations, server-side permission checks, CSRF checks for account mutations, and security/account pages. CEO assignment is a separately gated operator action. Automated tests cover backend access control and session behavior.

Remaining before production use: hardened external identity deployment, provider SMTP/recovery-flow operations, tested MFA AMR mapping and passkey configuration, externally anchored append-only audit retention, SIEM integration, production secrets management, backups/restore, incident response, and independent security review. Provider-side authentication failures are not currently imported into BillGenie's security event view.

## Phase 3 — ingestion and workflow simulation

Add only sandbox invoice ingestion and approval workflow simulation after defining tenant boundaries, separation of duties, replay protection, evidence rules, and audit retention. Do not represent synthetic approvals as real financial actions.

## Phase 4 — integrations and operations

Any evaluation of ERP/provider integrations requires explicit business authorization and a separate security review. Production payment initiation remains outside the current scope and disabled.
