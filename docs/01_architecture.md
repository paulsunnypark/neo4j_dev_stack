# 01. 전체 아키텍처

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                        클라이언트 / 외부 시스템                       │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI (port 8000)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │  /entities  │  │/relationships│  │  /health  /metrics     │  │
│  │  /devices   │  │              │  │  /outbox/stats         │  │
│  └──────┬──────┘  └──────┬───────┘  └────────────────────────┘  │
│         │                │                                        │
│         └────────────────▼                                        │
│              EventRepository.append_event()                       │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              ProjectionWorker (asyncio.Task)                 │  │
│  │  PENDING → PROCESSING → DONE / FAILED  (poll 1s, batch 50) │  │
│  └────────────────────────────┬────────────────────────────────┘  │
└───────────────────────────────┼─────────────────────────────────┘
                                │
          ┌─────────────────────┼──────────────────────┐
          │                     │                       │
          ▼                     ▼                       │
┌──────────────────┐  ┌──────────────────┐             │
│   PostgreSQL     │  │    Neo4j 5.26    │             │
│   (port 5435)    │  │  (port 7690)     │             │
│                  │  │                  │             │
│  event_log       │  │  :Entity nodes   │             │
│  outbox          │  │  relationships   │             │
└──────────────────┘  └──────────────────┘             │
                                                        │
                               ┌────────────────────────▼──────────┐
                               │         Prometheus (9093)          │
                               │  neo4j_dev_neo4j:2004              │
                               │  host.docker.internal:8000/metrics │
                               └──────────────────┬─────────────────┘
                                                  │
                                                  ▼
                                       ┌──────────────────┐
                                       │  Grafana (3003)  │
                                       │  자동 프로비저닝    │
                                       └──────────────────┘
```

## 핵심 설계 원칙

### 1. Outbox 패턴 (Transactional Outbox Pattern)

```
Write API 요청
    │
    ▼
PostgreSQL 트랜잭션 (원자적)
    ├── INSERT INTO event_log  → 이벤트 영구 기록 (감사 로그)
    └── INSERT INTO outbox     → status='PENDING'

ProjectionWorker (백그라운드)
    │
    ▼
SELECT ... FOR UPDATE SKIP LOCKED  → 동시성 안전
    │
    ├── status='PROCESSING'
    │
    ├── Neo4j 적용 (_apply_event)
    │       ├── 성공 → status='DONE'
    │       └── 실패 → status='FAILED', retry_count++, last_error=...
    │
    └── 반복 (POLL_INTERVAL_SEC=1.0, BATCH_SIZE=50)
```

**장점:**
- API 응답과 Neo4j 적용이 분리 → API는 빠르게 202 Accepted 반환
- Postgres 장애 시 이벤트 유실 없음 (event_log에 영구 보존)
- Neo4j 장애 시 FAILED 상태로 재시도 가능
- `FOR UPDATE SKIP LOCKED` → 다중 워커 인스턴스 확장 가능

### 2. 단일 프로세스 구조

FastAPI 프로세스 내에서 `asyncio.create_task()`로 ProjectionWorker를 구동.
별도 프로세스 불필요 → 개발 환경 단순화.

```python
# main.py lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    Neo4jManager.get_driver()
    await PostgresManager.init()
    worker = ProjectionWorker(GraphRepository(Neo4jManager.get_driver()))
    task = asyncio.create_task(worker.run_forever())
    yield
    worker.stop()
    task.cancel()
    ...
```

### 3. 시스템 오브 레코드 분리

| 저장소 | 역할 | 쓰기 | 읽기 |
|--------|------|------|------|
| **PostgreSQL** | 이벤트 원장 (불변) | API 직접 | 내부 (ProjectionWorker) |
| **Neo4j** | 그래프 월드 모델 | ProjectionWorker만 | API (GET 엔드포인트) |

API의 Write는 항상 Postgres → Neo4j는 Outbox를 통한 최종 일관성.

### 4. 범용 Entity 모델

특정 도메인(HA, Matter 등)에 종속되지 않는 범용 그래프 모델:

```
(:Entity {
    id:         String   -- 유니크 식별자
    entityType: String   -- "Device" | "Service" | "User" | 커스텀
    name:       String?
    status:     String?  -- "ONLINE" | "OFFLINE" | "RUNNING" 등
    updatedAt:  DateTime
    ...속성들   Any      -- 도메인별 자유 속성
})

(:Entity)-[:REL_TYPE {properties...}]->(:Entity)
-- REL_TYPE 예: DEPENDS_ON, CONNECTED_TO, MANAGES, OWNS 등
```

APOC 없이 동작하며, `upsert_relationship`은 APOC 시도 후 실패 시 정적 MERGE로 fallback.

## 기술 스택

| 계층 | 기술 | 버전 |
|------|------|------|
| Web Framework | FastAPI | 0.115.6 |
| ASGI Server | Uvicorn | 0.34.0 |
| Graph DB | Neo4j Community | 5.26 |
| Neo4j Driver | neo4j (async) | 5.28.1 |
| Relational DB | PostgreSQL | 16 |
| PG Driver | asyncpg | 0.30.0 |
| Config | pydantic-settings | 2.7.0 |
| Monitoring | prometheus-client | 0.21.0 |
| Testing | pytest + pytest-asyncio | 8.3.4 + 0.24.0 |
| HTTP Client (test) | httpx | 0.28.1 |
| Dashboard | Grafana | latest |
| Graph Dashboard | NeoDash | latest |
| Metrics | Prometheus | latest |
| Python | CPython | 3.13.5 |
| OS | Windows 11 | — |
| Container | Docker Desktop | — |

## 플러그인

Neo4j 5.26 Community에서 동작 확인된 플러그인:
- **APOC** — 유틸리티 함수 (apoc.merge.relationship 등)
- **n10s (Neosemantics)** — RDF/OWL 온톨로지 지원

**제거됨**: Graph Data Science (GDS) — Community Edition 5.26 미지원
