# BillGenie engineering conventions

## Phase 1 and Phase 2 scope

- Use synthetic fixtures only. Keep the dashboard read-only and label sample data wherever it is shown.
- Keep live payments, production ERPNext, and external financial systems disconnected. Do not add provider credentials, callbacks, payment initiation, or real approval actions.
- Authentication uses the configured OpenID Connect provider. Never add local password or OTP collection.
- Enforce role permissions on backend endpoints; frontend visibility is not authorization.
- Keep identity-provider recovery, TOTP, WebAuthn, and recovery-code flows separate from bank authentication.
- Do not describe controls as implemented until enforced and tested. Keep provider setup and test-only behavior out of production configuration.
- Obtain confirmation before destructive operations, including deleting local database volumes or resetting data.

## Secure coding

- Never collect, store, transmit, or log OTPs, CVVs, UPI PINs, or banking passwords.
- Keep credentials and tokens out of Git, fixtures, logs, and client bundles. Commit only placeholders in environment templates. Use local ignored environment files for development and an approved secrets manager for deployed environments.
- Bind development services to loopback. Validate untrusted inputs at the API boundary, use parameterized database queries when persistence is added, and return generic errors without sensitive details.
- Treat server-side authorization, separation of duties, replay protection, and audit logging as requirements for future approval and payment workflows. Require verified provider evidence before representing a real transaction as paid.
- Keep CEO assignment out of ordinary admin APIs; use the separately approved operator workflow and audit it.
- Store only opaque session-token hashes and CSRF-token hashes in the application database. Never persist identity-provider credentials, access tokens, TOTP seeds, or recovery codes.
- Never log passwords, tokens, reset links, session values, CSRF values, OTPs, or full invitation links.
- Use explicit currency and decimal monetary values for future billing and reconciliation logic. Keep sample display data separate from production data models.
- Run the relevant checks in the README after changes. Keep changes focused and follow the user's instructions about publishing or pushing.
