# BillGenie

BillGenie is AutomateGenie's subscription billing, CEO approval, and payment monitoring platform. The dashboard includes a read-only vendor directory, subscription renewal dates, and invoice tracking with vendor and status filters. FastAPI serves synthetic data. PostgreSQL and Redis are available for local development, and the current dashboard runs without either service.

Authentication, MFA, RBAC, and real approval actions are future work. Live payments are disabled, and ERPNext and external financial systems are disconnected.

## Windows PowerShell setup

Install Node.js 22 or newer, Python 3.12 with the Windows Python Launcher, and Docker Desktop with Compose v2. Docker Desktop is required for the PostgreSQL and Redis steps. The commands assume the checkout is at `C:\Projects\BillGenie`.

Install the frontend and backend dependencies from the repository root. The Python commands use the virtual environment directly and work without changing PowerShell's execution policy.

```powershell
Set-Location C:\Projects\BillGenie

Push-Location frontend
$env:NEXT_TELEMETRY_DISABLED = '1'
npm.cmd ci
Pop-Location

py -3.12 -m venv backend\.venv
.\backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt
```

## Start PostgreSQL and Redis

Start Docker Desktop and run the following from the repository root. The first run generates a random development password in the ignored root `.env`. Later runs preserve the local file and the database password. The services bind to IPv4 loopback on ports 5432 and 6379 by default. You can change the host ports in `.env` before startup.

```powershell
Set-Location C:\Projects\BillGenie
if (-not (Test-Path -LiteralPath .env)) {
    $postgresPassword = [guid]::NewGuid().ToString('N')
    (Get-Content -LiteralPath .env.example -Raw) -replace '(?m)^POSTGRES_PASSWORD=(?=\r?$)', "POSTGRES_PASSWORD=$postgresPassword" |
        Set-Content -LiteralPath .env -Encoding ascii
}
docker compose config --quiet
docker compose up -d --wait
docker compose ps
```

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

The dashboard reads `GET /vendors`, `GET /subscriptions`, and `GET /invoices` from the local API on port 8000. In Subscriptions, review renewal dates, billing cadence, expected amounts, and the vendor directory. In Invoices, select a vendor or status and choose **Apply filters**. Filter choices are part of the URL. The sample amounts use INR and the API represents them in integer paise.

## Run checks

```powershell
Set-Location C:\Projects\BillGenie\frontend
$env:NEXT_TELEMETRY_DISABLED = '1'
npm.cmd test
npm.cmd run typecheck
npm.cmd run build

Set-Location C:\Projects\BillGenie\backend
.\.venv\Scripts\python.exe -m pytest tests

Set-Location C:\Projects\BillGenie
docker compose config --quiet
```

See [AGENTS.md](AGENTS.md) for secure coding and development conventions.
