# BillGenie

BillGenie is AutomateGenie's Phase 1 read-only billing dashboard with a Phase 2 identity foundation. It includes the synthetic financial dashboard, Keycloak OpenID Connect sign-in, PostgreSQL-backed role assignments and sessions, and account/security administration. Redis remains optional and is not part of the authentication path.

The application does not collect passwords or MFA codes: Keycloak owns credential, email verification, TOTP, and recovery flows. Backend API routes enforce database-backed roles and permissions. Local Keycloak runs in development mode and must never be used as a production identity deployment. Live payments, real approval mutations, production ERPNext, and external financial systems remain disconnected. Every financial-looking record is synthetic; `Simulated paid` does not mean a real payment occurred.

## Windows PowerShell setup

Install Node.js 22 or newer, Python 3.12 with the Windows Python Launcher, and Docker Desktop with Compose v2. Docker Desktop is required for PostgreSQL and local Keycloak. The commands assume the checkout is at `C:\Projects\BillGenie`.

Install the frontend and backend dependencies from the repository root, then create ignored local environment files with unique development secrets. Never reuse these settings in production.

```powershell
Set-Location C:\Projects\BillGenie

Push-Location frontend
$env:NEXT_TELEMETRY_DISABLED = '1'
npm.cmd ci
Pop-Location

py -3.12 -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt

if (-not (Test-Path -LiteralPath .env)) {
    $pgPassword = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    $keycloakPassword = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    (Get-Content -LiteralPath .env.example -Raw).Replace('POSTGRES_PASSWORD=', "POSTGRES_PASSWORD=$pgPassword").Replace('KEYCLOAK_BOOTSTRAP_ADMIN_PASSWORD=', "KEYCLOAK_BOOTSTRAP_ADMIN_PASSWORD=$keycloakPassword") |
        Set-Content -LiteralPath .env -Encoding ascii
}
if (-not (Test-Path -LiteralPath backend\.env)) {
    $pgPassword = (Select-String -Path .env -Pattern '^POSTGRES_PASSWORD=(.+)$').Matches[0].Groups[1].Value
    $oidcStateKey = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    (Get-Content -LiteralPath backend\.env.example -Raw).Replace('replace-with-postgres-password', $pgPassword).Replace('BILLGENIE_OIDC_STATE_KEY=', "BILLGENIE_OIDC_STATE_KEY=$oidcStateKey") |
        Set-Content -LiteralPath backend\.env -Encoding ascii
}
```

## Start PostgreSQL, Redis, and Keycloak

Start Docker Desktop and run the following from the repository root. All local service ports bind to IPv4 loopback. The realm disables public registration, requires verified email, enables brute-force protection, uses 5-minute access tokens, and requires TOTP setup for new identities.

```powershell
Set-Location C:\Projects\BillGenie
docker compose config --quiet
docker compose up -d --wait postgres redis keycloak
docker compose ps
```

Keycloak Admin Console: `http://localhost:8080/admin`. Its local container runs development mode and must not be deployed. Production requires a hardened OIDC deployment, HTTPS, SMTP, and production-grade identity storage.

To stop the containers while retaining their data, run `docker compose stop` from the repository root.

## Run the dashboard and API

Run the frontend in one PowerShell window.

```powershell
Set-Location C:\Projects\BillGenie\frontend
$env:NEXT_TELEMETRY_DISABLED = '1'
npm.cmd run dev
```

Run the API in a second PowerShell window.

```powershell
Set-Location C:\Projects\BillGenie\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Open the dashboard at `http://127.0.0.1:3000`. Check API liveness in a third PowerShell window.

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health | ConvertTo-Json -Compress
```

Expected response is `{"status":"ok"}`. It indicates that the API is serving requests. Compose reports PostgreSQL and Redis health separately. The frontend and backend `.env.example` files document optional shell settings.

The dashboard reads `GET /vendors`, `GET /subscriptions`, and `GET /invoices` from the local API on port 8000. In Subscriptions, review renewal dates, billing cadence, expected amounts, and the vendor directory. In Invoices, select a vendor or status and choose **Apply filters**. Filter choices are part of the URL. Sample amounts use INR and the API represents them in integer paise. API docs are at `http://127.0.0.1:8000/docs`; `/ready` checks process availability only, not database connectivity.

Authentication pages redirect to the local Keycloak development realm. PostgreSQL-backed role and session data requires the Compose services and Alembic schema. After starting the dependencies, apply migrations before starting the API:

```powershell
Set-Location C:\Projects\BillGenie\backend
..\.venv\Scripts\alembic.exe upgrade head
```

`/health` checks process liveness. `/ready` checks PostgreSQL connectivity and returns 503 while the database is unavailable. The Admin Console is for local development only. See [Windows setup](docs/SETUP_WINDOWS.md) for the first CEO bootstrap requirements and [security limits](docs/SECURITY.md) for controls that still need production validation.

## Run checks

```powershell
Set-Location C:\Projects\BillGenie\frontend
$env:NEXT_TELEMETRY_DISABLED = '1'
npm.cmd test
npm.cmd run typecheck
npm.cmd run build

Set-Location C:\Projects\BillGenie\backend
.\.venv\Scripts\python.exe -m pytest tests
..\.venv\Scripts\alembic.exe check

Set-Location C:\Projects\BillGenie
docker compose config --quiet
```

See [AGENTS.md](AGENTS.md) for secure coding and development conventions.

See [docs/SETUP_WINDOWS.md](docs/SETUP_WINDOWS.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SECURITY.md](docs/SECURITY.md), [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md), and [docs/DEVELOPMENT_ROADMAP.md](docs/DEVELOPMENT_ROADMAP.md) for implementation details and limitations.
