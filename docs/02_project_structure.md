# 02. 프로젝트 구조

## 디렉토리 트리

```
E:\neo4j_dev_stack\
├── .gitignore
├── .gitkeep
├── docs\                              ← 이 문서 모음
│   ├── README.md
│   ├── 01_architecture.md
│   ├── 02_project_structure.md        (현재 파일)
│   ├── 03_docker_ports.md
│   ├── 04_api_reference.md
│   ├── 05_domain_model.md
│   ├── 06_database_schema.md
│   ├── 07_testing.md
│   ├── 08_monitoring.md
│   ├── 09_dev_runbook.md
│   └── 10_session_log.md
│
├── docker\
│   ├── docker-compose.yml             ← 전체 인프라 정의 (name: neo4j_dev)
│   ├── neo4j\
│   │   └── conf\
│   │       └── neo4j.conf             ← Neo4j 설정 (현재 미마운트, env로 대체)
│   ├── postgres\
│   │   └── init\
│   │       ├── 001_schema.sql         ← event_log + outbox 테이블 정의
│   │       └── 002_seed.sql           ← 초기 데이터 (현재 비어있음)
│   └── monitoring\
│       ├── prometheus.yml             ← Prometheus 스크레이프 설정
│       └── grafana\
│           ├── provisioning\
│           │   ├── datasources\
│           │   │   └── prometheus.yml ← Grafana Datasource 자동 등록
│           │   └── dashboards\
│           │       └── dashboards.yml ← 대시보드 파일 경로 지정
│           └── dashboards\
│               └── neo4j_overview.json ← 9패널 Grafana 대시보드
│
└── backend\
    ├── .env                           ← 로컬 환경변수 (git 제외됨)
    ├── .gitignore
    ├── pytest.ini                     ← pytest 설정
    ├── requirements.txt               ← Python 의존성
    │
    ├── .venv\                         ← Python 가상환경 (git 제외됨)
    │
    ├── scripts\
    │   ├── apply_neo4j_migrations.py  ← Neo4j Cypher 마이그레이션 실행기
    │   └── run_projection_worker.py   ← 독립 실행용 (현재 미사용, main.py에 통합)
    │
    ├── app\
    │   ├── __init__.py
    │   │
    │   ├── main.py                    ← FastAPI 앱 진입점 (lifespan + 라우터)
    │   │
    │   ├── core\
    │   │   ├── __init__.py
    │   │   ├── config.py              ← pydantic-settings Settings
    │   │   ├── auth.py                ← API Key 인증 미들웨어
    │   │   ├── metrics.py             ← Prometheus Counter/Gauge 정의
    │   │   ├── neo4j.py               ← Neo4jManager (싱글턴 드라이버)
    │   │   └── postgres.py            ← PostgresManager (asyncpg 풀)
    │   │
    │   ├── models\
    │   │   ├── __init__.py
    │   │   ├── events.py              ← 이벤트 Payload Pydantic 모델 (6종)
    │   │   └── api.py                 ← API 응답 모델 (PagedResponse 등)
    │   │
    │   ├── repositories\
    │   │   ├── __init__.py
    │   │   ├── event_repository.py    ← Postgres event_log + outbox 쓰기
    │   │   └── graph_repository.py    ← Neo4j 읽기/쓰기 (CRUD + 페이지네이션)
    │   │
    │   ├── services\
    │   │   ├── __init__.py
    │   │   ├── projection_worker.py   ← Outbox 투영 워커 (PENDING→DONE/FAILED)
    │   │   └── simulation_service.py  ← 레거시 Device 이벤트 헬퍼 (하위 호환)
    │   │
    │   └── migrations\
    │       ├── neo4j_001_constraints.cypher ← Entity/Device 제약·인덱스
    │       ├── neo4j_002_seed.cypher        ← Entity 초기 데이터
    │       └── neo4j_003_neodash.cypher     ← NeoDash 대시보드 seed
    │
    └── tests\
        ├── __init__.py
        ├── conftest.py                ← 공통 픽스처 (Neo4j/Postgres mock)
        ├── unit\
        │   ├── __init__.py
        │   ├── test_models.py         ← Pydantic 모델 유효성 검사 (11개)
        │   └── test_projection_worker.py ← 워커 이벤트 처리 단위 테스트 (10개)
        └── e2e\
            ├── __init__.py
            └── test_api_e2e.py        ← API 전체 흐름 테스트 (14개)
```

## 파일별 역할 요약

### `app/main.py`
- FastAPI 앱 정의 + lifespan 훅
- ProjectionWorker를 asyncio.Task로 구동
- `/metrics` Prometheus 엔드포인트 마운트
- 글로벌 500 에러 핸들러
- 모든 API 라우터 정의 (엔드포인트 목록은 [04_api_reference.md](04_api_reference.md) 참조)

### `app/core/config.py`
- `pydantic-settings BaseSettings` 기반
- `.env` 파일 + 환경변수 자동 로드
- `settings` 싱글턴 인스턴스 제공

### `app/core/auth.py`
- `X-API-Key` 헤더 기반 인증
- `settings.api_key == ""` 이면 dev 모드 (인증 생략 → 403 없음)
- `Depends(verify_api_key)` 로 보호된 엔드포인트에 적용

### `app/core/metrics.py`
```python
OUTBOX_PROCESSED = Counter("outbox_processed_total", ..., ["event_type"])
OUTBOX_FAILED    = Counter("outbox_failed_total", ..., ["event_type"])
OUTBOX_PENDING   = Gauge("outbox_pending_count", ...)
metrics_app      = make_asgi_app()  # /metrics 마운트용
```

### `app/repositories/graph_repository.py`
핵심 Neo4j 연산. `_sanitize()` 함수로 `neo4j.time.DateTime` → ISO 문자열 변환.
전체 메서드 목록은 [05_domain_model.md](05_domain_model.md) 참조.

### `app/services/projection_worker.py`
- `POLL_INTERVAL_SEC = 1.0`, `BATCH_SIZE = 50`
- `FOR UPDATE SKIP LOCKED` 으로 동시성 안전 처리
- 실패 시 `status='FAILED'`, `retry_count++`, `last_error` 기록
- 메트릭 카운터 증가 (try/except로 임포트 실패 보호)

### `scripts/apply_neo4j_migrations.py`
- `neo4j_*.cypher` 파일을 알파벳순 정렬 실행
- `;` 로 구문 분리, `--` 주석 라인 필터링 후 각각 `execute_write`
- 멱등성 보장: `CREATE CONSTRAINT IF NOT EXISTS`, `MERGE` 사용
