# 09. 개발 환경 Runbook

## 전제조건

| 항목 | 버전 | 확인 명령 |
|------|------|---------|
| Python | 3.13.x | `python --version` |
| Docker Desktop | 최신 | `docker --version` |
| Git | — | `git --version` |

---

## 최초 환경 구성

```powershell
# 1. 리포지토리 클론
git clone <repo-url> E:\neo4j_dev_stack
cd E:\neo4j_dev_stack

# 2. Python 가상환경 생성 및 패키지 설치
cd backend
python -m venv .venv
.venv\Scripts\pip.exe install -r requirements.txt

# 3. .env 파일 생성 (예시 기반)
# .env 내용은 docs/03_docker_ports.md 참조

# 4. Docker 기동
cd ..\docker
docker compose up -d

# 5. Neo4j 마이그레이션 적용 (Neo4j healthy 확인 후)
cd ..\backend
.venv\Scripts\python.exe scripts\apply_neo4j_migrations.py

# 6. FastAPI 시작
.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000
```

---

## 일상적인 개발 사이클

### Docker 기동/중지

```powershell
cd E:\neo4j_dev_stack\docker

# 전체 기동
docker compose up -d

# 전체 중지 (데이터 유지)
docker compose down

# 특정 서비스만 재시작
docker compose restart neo4j_dev_neo4j

# 로그 확인
docker compose logs -f neo4j_dev_neo4j
docker compose logs -f neo4j_dev_postgres

# 컨테이너 상태 확인
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### FastAPI 시작/재시작

```powershell
cd E:\neo4j_dev_stack\backend

# 포트 8000 점유 프로세스 확인 및 종료
$pid = (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue).OwningProcess
if ($pid) { Stop-Process -Id $pid -Force; Write-Host "Killed PID $pid" }

# 포어그라운드 실행 (개발용, 로그 직접 확인)
.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload

# 백그라운드 실행 (로그 파일로)
Start-Process -FilePath ".venv\Scripts\uvicorn.exe" `
  -ArgumentList "app.main:app","--host","0.0.0.0","--port","8000" `
  -RedirectStandardOutput "uvicorn.log" `
  -RedirectStandardError "uvicorn_err.log" `
  -NoNewWindow
```

### 패키지 추가

```powershell
cd E:\neo4j_dev_stack\backend
.venv\Scripts\pip.exe install <package>==<version>
# requirements.txt에 수동 추가 후 커밋
```

---

## 마이그레이션

### Neo4j 마이그레이션 실행

```powershell
cd E:\neo4j_dev_stack\backend
.venv\Scripts\python.exe scripts\apply_neo4j_migrations.py
```

### 새 마이그레이션 추가

1. `backend/app/migrations/neo4j_004_*.cypher` 파일 생성
2. `;` 로 구문 구분, `--` 주석 사용 가능
3. `CREATE ... IF NOT EXISTS` 또는 `MERGE` 로 멱등성 보장
4. 스크립트 재실행

```cypher
-- 예시: 새로운 인덱스 추가
CREATE INDEX entity_name IF NOT EXISTS FOR (e:Entity) ON (e.name);
```

---

## 테스트

```powershell
cd E:\neo4j_dev_stack\backend

# 전체 테스트 (실제 DB 불필요 — mock 사용)
.venv\Scripts\python.exe -m pytest tests/ -v

# 단위 테스트만 (빠름)
.venv\Scripts\python.exe -m pytest tests/unit/ -v

# E2E 테스트만
.venv\Scripts\python.exe -m pytest tests/e2e/ -v

# 커버리지 HTML 리포트
.venv\Scripts\python.exe -m pytest tests/ --cov=app --cov-report=html
# → htmlcov/index.html 에서 확인
```

---

## API 테스트 (PowerShell)

```powershell
$base = "http://localhost:8000"
$headers = @{'X-API-Key' = 'dev-secret-key-change-me'; 'Content-Type' = 'application/json'}

# 헬스 체크 (인증 불필요)
Invoke-RestMethod "$base/health"

# Entity 생성
Invoke-RestMethod "$base/entities" -Method POST -Headers $headers `
  -Body '{"entity_id":"test-1","entity_type":"Device","name":"Test"}'

# 목록 조회
Invoke-RestMethod "$base/entities?page=1&size=20" -Headers $headers

# 타입 필터
Invoke-RestMethod "$base/entities?entity_type=Device" -Headers $headers

# 관계 생성
Invoke-RestMethod "$base/relationships" -Method POST -Headers $headers `
  -Body '{"from_id":"test-1","from_type":"Device","to_id":"svc-1","to_type":"Service","rel_type":"DEPENDS_ON"}'

# 상태 변경
Invoke-RestMethod "$base/entities/test-1/status" -Method POST -Headers $headers `
  -Body '{"entity_id":"test-1","entity_type":"Device","new_status":"OFFLINE"}'

# Outbox 통계
Invoke-RestMethod "$base/outbox/stats" -Headers $headers

# Prometheus 메트릭 (텍스트)
Invoke-RestMethod "$base/metrics"
```

---

## 데이터 리셋

### Neo4j 데이터만 초기화 (볼륨 삭제)

```powershell
cd E:\neo4j_dev_stack\docker
docker compose down
docker volume rm neo4j_dev_neo4j_data neo4j_dev_neo4j_logs neo4j_dev_neo4j_plugins
docker compose up -d
# 이후 마이그레이션 재적용 필요
cd ..\backend
.venv\Scripts\python.exe scripts\apply_neo4j_migrations.py
```

### Postgres 데이터만 초기화

```powershell
cd E:\neo4j_dev_stack\docker
docker compose down
docker volume rm neo4j_dev_pg_data
docker compose up -d
# postgres 컨테이너가 init 스크립트 자동 재실행
```

### Outbox FAILED 재처리

```powershell
# Postgres에 직접 접속
docker exec -it neo4j_dev_postgres psql -U ha -d ha_core -c `
  "UPDATE outbox SET status='PENDING', retry_count=0, last_error=NULL WHERE status='FAILED';"
```

---

## 자주 발생하는 문제 해결

### 문제: Neo4j 컨테이너 시작 실패

```powershell
# 로그 확인
docker logs neo4j_dev_neo4j

# 주요 원인 및 해결:
# 1. 플러그인 호환성 → NEO4J_PLUGINS에서 해당 플러그인 제거
# 2. 설정 오류 → NEO4J_server_config_strict__validation_enabled=false 확인
# 3. 볼륨 stale → docker volume rm neo4j_dev_neo4j_* 후 재생성
```

### 문제: FastAPI 포트 8000 충돌

```powershell
$pid = (Get-NetTCPConnection -LocalPort 8000 -State Listen).OwningProcess
Stop-Process -Id $pid -Force
```

### 문제: neo4j.time.DateTime JSON 직렬화 오류

```
pydantic_core.PydanticSerializationError: Unable to serialize unknown type: <class 'neo4j.time.DateTime'>
```

→ `graph_repository.py`의 `_sanitize()` 함수가 모든 `run_read` 결과에 적용됨.
직접 `run_read` 결과를 API에 반환하는 경우 `_sanitize()` 수동 호출 필요.

### 문제: 마이그레이션 SyntaxError (-- 주석)

```
CypherSyntaxError: Invalid input '-'
```

→ `apply_neo4j_migrations.py`의 `strip_comments()` 함수가 `--` 주석을 제거함.
Cypher 파일의 `//` 스타일 주석은 그대로 통과됨.

### 문제: E2E 테스트 403 Forbidden

테스트 중 `settings.api_key`가 `.env`에서 읽혀서 인증 요구.

→ `conftest.py`의 `async_client` 픽스처에서 `patch.object(core_config.settings, "api_key", "")` 확인.

### 문제: AsyncMock context manager TypeError

```
TypeError: 'coroutine' object does not support the asynchronous context manager protocol
```

→ `AsyncMock` 대신 `MagicMock`을 context manager 래퍼로 사용.
`__aenter__`와 `__aexit__`를 `AsyncMock`으로 명시적 설정 (conftest 참조).

---

## Git 워크플로우

```powershell
cd E:\neo4j_dev_stack

# 상태 확인
git status

# 변경 사항 커밋 (테스트 통과 후)
git add backend/ docker/ docs/
git commit -m "feat/fix/docs: 변경 내용 요약"

# 로그 확인
git log --oneline
```

**커밋 컨벤션:**
- `feat:` 새 기능
- `fix:` 버그 수정
- `docs:` 문서 변경
- `test:` 테스트 추가/수정
- `refactor:` 리팩터링
- `chore:` 빌드/설정 변경
