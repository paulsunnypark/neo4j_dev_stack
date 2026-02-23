# 10. 세션 작업 이력

작업 세션별 변경 내용, 해결한 이슈, 다음 작업을 기록합니다.

---

## Session 1 — 초기 상태 확인

**날짜:** 2026-02 (정확한 날짜 불명)
**커밋:** `e731ec9` Initialize repository

**작업 내용:**
- 기존 코드 파악: Docker Compose 5서비스, FastAPI 백엔드, Outbox 패턴 골격 확인
- HA/Matter 도메인 특화 코드 발견 (Device 하드코딩)

---

## Session 2 — 전체 스택 최초 가동

**날짜:** 2026-02
**커밋:** `7761d16` feat: 전체 스택 초기 구현 및 환경 세팅 완료

**작업 내용:**
1. Docker Desktop 시작 후 기존 컨테이너 포트 충돌 해결
2. Neo4j 시작 실패 4회 반복 해결:
   - `neo4j.conf` `:ro` 마운트 → chown 실패 → 마운트 제거
   - `graph-data-science` Community 5.26 미지원 → 제거
   - `server.metrics.prometheus.endpoint` 미인식 → `strict_validation_enabled=false` 추가
   - 볼륨 stale 설정 → 볼륨 삭제 후 재생성
3. Python 3.13.5 venv 생성, requirements 설치
4. `apply_neo4j_migrations.py` 수정: 세미콜론 분리 실행 (기존: 전체 파일 단일 쿼리 → SyntaxError)
5. `main.py` lifespan으로 ProjectionWorker 통합
6. projection_worker: asyncpg JSONB payload 자동 파싱 버그 수정 (`json.loads`)
7. E2E 검증: `POST /devices/dev-1/status` → outbox DONE → `GET /devices` 정상

**해결한 이슈:**
| 이슈 | 원인 | 해결 |
|------|------|------|
| `chown: Read-only file system` | neo4j.conf :ro 마운트 | 마운트 제거 |
| GDS 플러그인 호환 불가 | Community 5.26 미지원 | NEO4J_PLUGINS에서 제거 |
| `Unrecognized setting` | strict_validation=true | false로 변경 |
| `sed: cannot rename` exit 4 | 볼륨 stale conf | 볼륨 삭제 재생성 |
| `Expected exactly one statement` | multi-statement cypher | 세미콜론 분리 실행 |
| `string indices must be integers` | JSONB→str auto-parse 안됨 | json.loads 추가 |

---

## Session 3 — 범용 개발 스택 강화

**날짜:** 2026-02-23
**커밋:** `ddaae65` feat: 범용 개발 스택 강화 (도메인 모델, API, 테스트, 모니터링, NeoDash)

### Task 0 — Docker 포트/이름 변경

**변경 파일:**
- `docker/docker-compose.yml` — name: neo4j_dev, container_name 접두사, 포트 +3
- `backend/.env` — NEO4J_URI, PG_PORT 업데이트, API_KEY, LOG_LEVEL 추가
- `docker/monitoring/prometheus.yml` — neo4j_dev_neo4j 타겟, FastAPI scrape 추가

**포트 변경:** 모든 서비스 기본값 +3 (충돌 방지)

### Task 2 — 범용 도메인 모델

**신규 파일:**
- `backend/app/models/__init__.py`
- `backend/app/models/events.py` — 6종 이벤트 Pydantic 모델
- `backend/app/models/api.py` — PagedResponse, ErrorResponse, HealthResponse, EventQueued

**수정 파일:**
- `backend/app/repositories/graph_repository.py`
  - `_sanitize()` 함수: Neo4j DateTime → ISO 문자열
  - `run_write()` 추가 (기존 `run_read` 대칭)
  - `upsert_entity()`, `delete_entity()`, `set_attribute()`, `set_status()`
  - `upsert_relationship()` — APOC + 정적 MERGE fallback
  - `remove_relationship()`
  - `list_entities()` — 페이지네이션
  - `count_entities()`
  - `upsert_device()` — 하위 호환 유지
- `backend/app/services/projection_worker.py`
  - `_apply_event()`: 6종 이벤트 + 레거시
  - `logger.exception` 에러 상세 로깅
  - 메트릭 카운터 증가 (lazy import)
- `backend/app/migrations/neo4j_001_constraints.cypher` — Entity 제약/인덱스 추가
- `backend/app/migrations/neo4j_002_seed.cypher` — Entity 기반 seed

### Task 6 — API 개선

**신규 파일:**
- `backend/app/core/auth.py` — X-API-Key 인증, dev 모드
- `backend/app/core/metrics.py` — Prometheus Counter/Gauge

**수정 파일:**
- `backend/app/core/config.py` — pydantic-settings 기반 재작성
- `backend/app/main.py` — 전면 개편
  - lifespan 컨텍스트 매니저
  - /metrics 마운트
  - 글로벌 예외 핸들러 (500 JSONResponse)
  - 개선된 /health (Neo4j verify_connectivity + Postgres ping)
  - 신규 엔드포인트: /entities, /relationships, /outbox/stats
  - 레거시 유지: /devices

### Task 1 — pytest 테스트

**신규 파일:**
- `backend/requirements.txt` — pydantic-settings, prometheus-client, pytest, pytest-asyncio, pytest-cov, httpx, anyio 추가
- `backend/pytest.ini`
- `backend/tests/conftest.py`
- `backend/tests/unit/test_models.py` (11개)
- `backend/tests/unit/test_projection_worker.py` (10개)
- `backend/tests/e2e/test_api_e2e.py` (14개)

### Task 3 — Grafana 대시보드

**신규 파일:**
- `docker/monitoring/grafana/provisioning/datasources/prometheus.yml`
- `docker/monitoring/grafana/provisioning/dashboards/dashboards.yml`
- `docker/monitoring/grafana/dashboards/neo4j_overview.json` (9패널)

### Task 4 — NeoDash 대시보드 seed

**신규 파일:**
- `backend/app/migrations/neo4j_003_neodash.cypher`
  - `_Neodash_Dashboard` 노드 MERGE
  - 2페이지 (Overview, Relationships), 7개 패널

---

### 이 세션에서 해결한 추가 이슈

| 이슈 | 원인 | 해결 |
|------|------|------|
| `Invalid input '-'` (마이그레이션) | `--` 주석이 Cypher 구문으로 전달됨 | `strip_comments()` 함수 추가 |
| `Unable to serialize unknown type: neo4j.time.DateTime` | Neo4j DateTime Pydantic 직렬화 불가 | `_sanitize()` 함수 추가, `run_read` 결과 전처리 |
| E2E 테스트 403 Forbidden | `.env`의 API_KEY 설정값으로 인증 요구 | `conftest.py`에서 `settings.api_key = ""` patch |
| E2E 테스트 `TypeError: coroutine object does not support async context manager` | `AsyncMock.session()` → coroutine 반환 | `MagicMock` + `__aenter__`/`__aexit__` 명시적 설정 |

---

## 현재 상태 (2026-02-23 기준)

### 실행 중인 서비스
| 서비스 | 상태 | 포트 |
|--------|------|------|
| neo4j_dev_neo4j | healthy | 7477, 17687, 2007 |
| neo4j_dev_postgres | healthy | 5435 |
| neo4j_dev_neodash | starting/healthy | 5008 |
| neo4j_dev_prometheus | running | 9093 |
| neo4j_dev_grafana | running | 3003 |
| FastAPI | running | 8000 |

### 테스트 결과
- **단위 테스트:** 21/21 통과
- **E2E 테스트:** 14/14 통과
- **전체:** 35/35 통과

### Git 상태
- 브랜치: `main`
- 커밋: `ddaae65`
- remote: origin/main 보다 2커밋 ahead (push 미수행)

---

## 알려진 제한사항

1. **ProjectionWorker 재시도 없음**: FAILED 상태 이벤트는 수동으로 PENDING 리셋 필요
2. **단일 프로세스**: ProjectionWorker가 FastAPI 내에 있어 스케일아웃 불가. 다중 인스턴스 필요 시 별도 워커 프로세스로 분리 권장
3. **NeoDash 자동 로그인 없음**: 첫 접속 시 Neo4j 자격증명 수동 입력 필요
4. **Grafana /metrics 타겟**: `host.docker.internal:8000` 은 Docker Desktop에서만 동작. Linux 환경에서는 호스트 IP 직접 지정 필요
5. **test 커버리지**: `graph_repository.py` ~29% — 실제 Neo4j DB 연동 통합 테스트 부재

---

## 다음 작업 후보

| 우선순위 | 작업 | 설명 |
|---------|------|------|
| 높음 | ProjectionWorker 재시도 로직 | FAILED 이벤트 자동 재시도 (backoff) |
| 높음 | MEMORY.md 업데이트 | 새 포트/구조 반영 |
| 중간 | 통합 테스트 추가 | 실제 Docker DB 연동 pytest-docker |
| 중간 | API 속성 변경 단축 엔드포인트 | `PATCH /entities/{id}` |
| 낮음 | WebSocket 실시간 스트림 | `/ws/events` |
| 낮음 | 이벤트 리플레이 API | event_log 기반 특정 시점 재투영 |
| 낮음 | OpenAPI 스키마 고도화 | 예시 값, 더 자세한 설명 |

---

## Session Update (2026-02-23, project_id 필수화)

### 반영 요약
- API/모델/워커/저장소 전반에 `project_id` 필수화 적용
- Neo4j 식별키를 `id` 단일키에서 `(projectId, id)` 복합키로 전환
- 다중 프로젝트 운영 문서 신규 추가 및 기존 문서 최신화
- NeoDash 접속/운영 가이드를 현재 설정으로 정리

### 핵심 변경 파일
- `backend/app/models/events.py`
- `backend/app/main.py`
- `backend/app/repositories/graph_repository.py`
- `backend/app/services/projection_worker.py`
- `backend/app/services/simulation_service.py`
- `backend/app/migrations/neo4j_004_project_tenancy.cypher` (신규)
- `docs/11_multi_project_playbook.md` (신규)

### 데이터/마이그레이션
- `neo4j_004_project_tenancy.cypher` 적용 완료
- 기존 seed는 제약 충돌 방지를 위해 `id` 기반 `MERGE` + `projectId` 보정 방식으로 수정

### 검증
- pytest: `28 passed`
- 실행 확인: health 응답 정상
