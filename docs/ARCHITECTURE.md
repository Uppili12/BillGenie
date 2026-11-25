# Architecture

## Request paths

The Next.js App Router serves the dashboard and account/security pages. Server-rendered account, audit, security, and admin views forward the incoming session cookie to FastAPI. Client account actions send requests directly to the API with credentials and a CSRF header.

FastAPI serves synthetic catalog data and applies authorization dependencies on protected routes. OIDC login is handled by Authlib using Authorization Code with PKCE against Keycloak. The API maps a verified provider identity to a local user, checks database roles and permissions, and issues a random opaque application session. Only hashes of session and CSRF tokens are persisted. PostgreSQL stores users, roles, permissions, invitations, sessions, MFA observations, security events, and hash-chained audit events. Alembic migrations create the schema and seed the Phase 2 permission catalog.

Keycloak is an optional local development identity provider defined in Compose. Its imported realm is deliberately isolated from external providers and uses a development server mode. Compose's local Postgres and Keycloak data use named volumes; ordinary stop/start preserves those volumes.

## Authorization boundaries

The frontend proxy redirects users for navigation only. FastAPI authenticates each protected API request and evaluates database-backed permissions. The development OIDC client uses fixed issuer, callback, and post-logout URLs from configuration. Provider tokens are not retained as application sessions.

Finance and Auditor roles can read financial catalogs. Administrator can administer invited accounts and revoke sessions, but cannot grant CEO. Security readers see application-recorded security events. Auditors can read audit events and request hash-chain verification. Mutating admin actions require CSRF validation and a recent MFA signal. Initial CEO bootstrapping is an operator command gated by explicit environment subject/change ID and verified MFA evidence.

## Runtime endpoints

- `GET /health` is process liveness.
- `GET /ready` checks PostgreSQL connectivity and returns 503 when unavailable.
- `GET /vendors`, `/subscriptions`, `/invoices` serve synthetic records and require `financial:read`.
- `/auth/*` handles the OIDC redirect/callback and local application sessions.
- `/admin/*`, `/security/*`, and `/audit/*` enforce their respective backend permissions.

All development services bind to loopback. This is not a production deployment design. See [security controls and limits](SECURITY.md) and [the threat model](THREAT_MODEL.md).
