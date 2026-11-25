# Security controls and limits

## Enforced in this phase

- The dashboard and all financial records remain synthetic and read-only. No payment, approval, production ERPNext, or external financial-system integration is connected.
- OIDC Authorization Code with PKCE is the only sign-in path. The API validates the provider identity and verified email, and issues an opaque, short-lived application session in an HttpOnly cookie. It stores session token hashes, not provider access tokens. Missing OIDC configuration fails closed.
- The API checks active account state and database-backed roles/permissions on protected routes. The frontend proxy is only a navigation aid; it is not the authorization boundary.
- Mutating account/security routes require a CSRF token and a recent provider MFA signal. CEO assignment is excluded from the user interface and requires the separate audited operator command.
- Password, TOTP, and recovery-code entry remain at the identity provider. The app does not collect credentials, OTPs, recovery codes, CVVs, UPI PINs, or banking passwords.
- Local Keycloak is a development-only `start-dev` deployment, bound to loopback. The imported realm disables registration, requires verified email and TOTP setup, and enables brute-force protection. It is not a production identity configuration.
- Invitations store only a token hash and expire after 24 hours. The one-time URL is returned to the authorized admin because no mail delivery integration is configured; transfer it through an approved channel.
- Audit events are hash-chained in the application database, with verification available through the API. This detects accidental edits and some tampering, but a database owner able to rewrite rows and the chain head can conceal changes. External append-only storage/anchoring is not configured.
- Security event summaries reflect events recorded by BillGenie. Identity-provider failed-password attempts and lockouts are not ingested, so the dashboard must not imply it shows those events.
- Development credentials belong only in ignored local `.env` files. Templates contain placeholders. Do not commit credentials or provider tokens.

## Operational requirements and limits

Use HTTPS, production-grade OIDC, durable backups, a secrets manager, SMTP and provider recovery-flow configuration before deployment. Configure WebAuthn/passkeys and recovery methods at the provider and verify their AMR claims before relying on them. Recent MFA enforcement fails closed unless a recognized `amr` claim was observed; a TOTP setup screen alone is not proof of a successful MFA-authenticated session.

Local logout revokes BillGenie sessions. Revoking another user's application session does not terminate that person's identity-provider SSO session. Provider SSO logout is attempted when the current user signs out.

Administrator role assignment cannot grant CEO, and users cannot modify their own roles. Initial CEO assignment requires an approved change ID, an explicitly configured subject, a verified active account, observed MFA, and an audited operator command. No default administrator or CEO is created.

The in-memory API rate limit is per process and is not a distributed abuse control. The audit chain is not an immutable ledger. This implementation is a development security foundation, not a certification or production deployment approval.
