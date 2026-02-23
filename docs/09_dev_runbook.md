# 09. Development Runbook

## 1) Initial Setup

```powershell
cd D:\neo4j_dev_stack\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

cd ..\docker
docker compose up -d

cd ..\backend
.\.venv\Scripts\python.exe scripts\apply_neo4j_migrations.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 2) Access

- NeoDash: `http://localhost:5008`
  - `neo4j / neo4j_password_change_me`
- API Docs: `http://localhost:8000/docs`

## 3) Required Tenant Rule

Always pass `project_id`.

Examples:
- `POST /entities` body contains `project_id`
- `GET /entities` includes `?project_id=...`
- `GET /outbox/stats` includes `?project_id=...`

## 4) Daily Commands

```powershell
cd D:\neo4j_dev_stack\docker
docker compose up -d
docker compose ps
docker compose logs -f neo4j neodash postgres
docker compose down
```

## 5) API Smoke Flow per Project

```powershell
$base = "http://localhost:8000"
$headers = @{'X-API-Key'='dev-secret-key-change-me'; 'Content-Type'='application/json'}

# create
Invoke-RestMethod "$base/entities" -Method POST -Headers $headers `
  -Body '{"project_id":"project-a","entity_id":"dev-1","entity_type":"Device","name":"Device 1"}'

# list
Invoke-RestMethod "$base/entities?project_id=project-a&page=1&size=20" -Headers $headers

# stats
Invoke-RestMethod "$base/outbox/stats?project_id=project-a" -Headers $headers
```

## 6) Multi-Project Operational Rules

- Never reuse the same request payload without explicit `project_id`
- Keep a dedicated `project_id` naming standard (e.g. `project-a`, `project-b`)
- For parallel test runs, use separate IDs per feature branch
- Verify isolation by comparing:
  - `/entities?project_id=project-a`
  - `/entities?project_id=project-b`

## 7) Common Issues

### `422` on API call
- Cause: missing `project_id`
- Fix: add required query/body field

### Mixed data in dashboards
- Cause: no project filter in query/report
- Fix: add `WHERE e.projectId = '<project_id>'` in NeoDash report queries

### 8000 port conflict

```powershell
$pid = (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($pid) { Stop-Process -Id $pid -Force }
```
