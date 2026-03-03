# 09. Development Runbook

## 1) Initial Setup

```powershell
cd D:\neo4j_dev_stack\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

cd ..\docker

# AuraDB mode (기본 운영 모드)
Copy-Item .env.aura.example .env.aura
# .env.aura 파일 값 수정 후
docker compose --env-file .env.aura up -d postgres backend frontend

cd ..\backend
.\.venv\Scripts\python.exe scripts\apply_neo4j_migrations.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 2) Access

- API Docs: `http://localhost:8000/docs`
- Frontend: `http://localhost:5173`

## 3) Required Tenant Rule

Always pass `project_id`.

Examples:
- `POST /entities` body contains `project_id`
- `GET /entities` includes `?project_id=...`
- `GET /outbox/stats` includes `?project_id=...`

## 4) Daily Commands

```powershell
cd D:\neo4j_dev_stack\docker
# AuraDB mode (기본)
docker compose --env-file .env.aura up -d postgres backend frontend

docker compose ps
docker compose logs -f backend postgres

docker compose down
```

## 4.1) Local Neo4j 설치 준비 (Docker 미포함)

로컬 설치형 Neo4j는 Docker 스택에 포함하지 않고, 필요 시 별도 프로세스로만 사용합니다.

```powershell
# 예시: 로컬 Neo4j를 17687(Bolt)로 실행한 경우
Copy-Item .env.local-install.example .env.local
# .env.local 값 수정 후
docker compose --env-file .env.local up -d postgres backend frontend
```

운영 기본값은 AuraDB이며, 로컬 Neo4j는 장애 대응/개발 실험용 fallback으로만 유지합니다.
Aura에서는 데이터베이스 이름이 `neo4j`가 아니라 인스턴스명(예: `7445e7b0`)인 경우가 많으므로 콘솔 값을 그대로 사용합니다.

### Frontend Quality Gate (local)

```powershell
cd D:\neo4j_dev_stack\frontend
npm run sync:api-types
npm run lint
npm run build
npm run test
npm run test:e2e
```

Notes:
- `sync:api-types` regenerates `src/api/schema.ts` from backend OpenAPI.
- If Playwright browser is missing, run `npx playwright install chromium` once.

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

### Frontend CORS blocked from browser
- Cause: backend `CORS_ORIGINS` does not include your frontend host.
- Fix (docker): set backend env `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`
- Fix (local backend): set `CORS_ORIGINS` in `backend/.env` and restart API.
