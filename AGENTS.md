# BillGenie engineering conventions

## Phase 1 scope

- Use synthetic fixtures only. Keep the dashboard read-only and label sample data wherever it is shown.
- Keep live payments, production ERPNext, and external financial systems disconnected. Do not add provider credentials, callbacks, payment initiation, or real approval actions.
- Authentication, MFA, and RBAC are future work. Describe controls as implemented only once they are enforced and tested.
- Obtain confirmation before destructive operations, including deleting local database volumes or resetting data.

## Secure coding

- Never collect, store, transmit, or log OTPs, CVVs, UPI PINs, or banking passwords.
- Keep credentials and tokens out of Git, fixtures, logs, and client bundles. Commit only placeholders in environment templates. Use local ignored environment files for development and an approved secrets manager for deployed environments.
- Bind development services to loopback. Validate untrusted inputs at the API boundary, use parameterized database queries when persistence is added, and return generic errors without sensitive details.
- Treat server-side authorization, separation of duties, replay protection, and audit logging as requirements for future approval and payment workflows. Require verified provider evidence before representing a real transaction as paid.
- Use explicit currency and decimal monetary values for future billing and reconciliation logic. Keep sample display data separate from production data models.
- Run the relevant checks in the README after changes. Keep changes focused and follow the user's instructions about publishing or pushing.
