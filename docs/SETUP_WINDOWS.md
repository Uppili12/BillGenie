# Windows setup

Use PowerShell from `C:\Projects\BillGenie`. Install Node.js 22+, Python 3.12, and Docker Desktop with Compose v2. Docker is needed for the PostgreSQL and Keycloak authentication stack. Redis is optional and is not used by the app request path.

Follow the full dependency and ignored `.env` setup in the repository [README](../README.md). Start the development dependencies with:

```powershell
Set-Location C:\Projects\BillGenie
docker compose config --quiet
docker compose up -d --wait postgres redis keycloak
```

Apply migrations without resetting data:

```powershell
Set-Location C:\Projects\BillGenie\backend
..\.venv\Scripts\alembic.exe upgrade head
```

For an initial CEO, first create a configured, verified identity in the development Keycloak realm. Set `BILLGENIE_INITIAL_CEO_SUBJECT` and `BILLGENIE_INITIAL_CEO_CHANGE_ID` in ignored `backend\.env`, restart the API, and run `python -m app.operations bootstrap-first-ceo` from the backend directory. This command fails unless the configured subject maps to an active, email-verified local user with an observed MFA sign-in. Do not set these values in a committed file. Later CEO assignments require the separately authorized audited command and a different MFA-verified CEO approver.

Run the frontend and API in separate PowerShell windows:

```powershell
Set-Location C:\Projects\BillGenie\frontend
$env:NEXT_TELEMETRY_DISABLED = '1'
npm.cmd run dev
```

```powershell
Set-Location C:\Projects\BillGenie\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Open `http://127.0.0.1:3000`. The API liveness endpoint is `/health`; `/ready` also checks database connectivity and returns 503 until PostgreSQL is reachable. Keycloak is at `http://localhost:8080`; its development Admin Console is `/admin`.

To stop containers and retain data, use `docker compose stop`. Do not run `docker compose down -v` unless you explicitly intend to delete local database volumes.
