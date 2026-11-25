# Phase 2 threat model

## Assets and trust boundaries

Phase 2 adds identity and account-security data but no production financial data or payment credentials. Assets include provider identity, verified email, local roles, opaque sessions, invitation tokens, security events, audit integrity, and synthetic catalog integrity. Trust boundaries are browser to Next.js, Next.js to FastAPI, FastAPI to PostgreSQL, and FastAPI to the configured OIDC issuer.

## Main risks and controls

- **Forged or replayed login:** state, nonce, and PKCE protect the OIDC redirect flow; issuer/user claims are validated by the OIDC client; login fails closed when provider settings are missing.
- **Stolen application session:** app sessions are random opaque values stored as hashes, short-lived, HttpOnly, revocable, and issued only to an active user with verified provider email. Secure cookie mode is required in production configuration.
- **Cross-site mutation:** admin mutations require a CSRF token and same-origin configured CORS policy. The app does not accept credentials in request bodies.
- **Role escalation:** protected endpoints check database permissions. Admins cannot grant CEO, cannot change their own role, and cannot access financial data unless separately granted. CEO bootstrap requires an explicit configured identity and change ID; later assignment requires a separate MFA-verified CEO approver.
- **Weak or absent MFA:** Keycloak requires TOTP setup in the development realm. Sensitive application mutations require a recent recognized provider MFA AMR claim and fail closed without it. Provider recovery codes and passkeys remain at the identity provider; their deployment configuration and AMR behavior require operational verification.
- **Invitation abuse:** tokens are random, only hashes are stored, links expire, and administrators must deliver the one-time URL through an approved channel. Email delivery is not configured.
- **Audit alteration:** each event hashes its predecessor and the stored head can be verified. A database owner who can rewrite both events and head can conceal tampering; external anchoring and immutable retention are not configured.
- **Misleading security metrics:** only BillGenie-recorded events are summarized. Keycloak failed login attempts and lockouts are not ingested.
- **Confusion with real financial activity:** catalog data remains synthetic, dashboard labels remain explicit, and there are no payment or approval mutation paths.
- **Credential disclosure:** local `.env` files are ignored, templates use placeholders, provider tokens/passwords are not logged, and no OTP/CVV/UPI PIN/banking password is collected.

## Remaining production work

Use a hardened identity deployment, HTTPS, managed secrets, SMTP, provider-side recovery and passkey configuration, tested MFA claims, externally retained audit evidence, distributed abuse controls, monitoring, backup/restore, incident response, and independent security review before considering deployment.
