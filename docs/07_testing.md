# 07. 테스트

## 테스트 구조

```
backend/tests/
├── conftest.py                    ← 공통 픽스처 (Mock DB)
├── unit/
│   ├── test_models.py             ← Pydantic 모델 유효성 (11개)
│   └── test_projection_worker.py  ← 이벤트 처리 단위 (10개)
└── e2e/
    └── test_api_e2e.py            ← API 전체 흐름 (14개)

총계: 35개 테스트, 전체 통과
```

## pytest 설정 (`pytest.ini`)

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --tb=short --cov=app --cov-report=term-missing
```

## 실행 명령

```powershell
cd E:\neo4j_dev_stack\backend

# 전체 테스트
.venv\Scripts\python.exe -m pytest tests/ -v

# 단위 테스트만
.venv\Scripts\python.exe -m pytest tests/unit/ -v

# E2E 테스트만
.venv\Scripts\python.exe -m pytest tests/e2e/ -v

# 특정 테스트 파일
.venv\Scripts\python.exe -m pytest tests/unit/test_models.py -v

# 커버리지 리포트
.venv\Scripts\python.exe -m pytest tests/ --cov=app --cov-report=html
```

## 픽스처 (`conftest.py`)

### `mock_neo4j_driver`
```python
@pytest.fixture
def mock_neo4j_driver():
    driver = MagicMock()
    session = AsyncMock()
    session.execute_read = AsyncMock(return_value=[])
    session.execute_write = AsyncMock(return_value=None)
    # async context manager 설정 (핵심: MagicMock + 명시적 __aenter__/__aexit__)
    session_ctx = MagicMock()
    session_ctx.__aenter__ = AsyncMock(return_value=session)
    session_ctx.__aexit__ = AsyncMock(return_value=False)
    driver.session = MagicMock(return_value=session_ctx)
    driver.verify_connectivity = AsyncMock(return_value=None)
    return driver
```

> **주의:** `AsyncMock`이 아닌 `MagicMock`을 driver와 session_ctx에 사용해야 함.
> `AsyncMock.session()`은 coroutine을 반환하여 `async with`에서 TypeError 발생.

### `mock_pg_conn`
```python
@pytest.fixture
def mock_pg_conn():
    conn = AsyncMock()
    # transaction()도 MagicMock으로 (async context manager)
    tx_ctx = MagicMock()
    tx_ctx.__aenter__ = AsyncMock(return_value=None)
    tx_ctx.__aexit__ = AsyncMock(return_value=False)
    conn.transaction = MagicMock(return_value=tx_ctx)
    conn.fetchval = AsyncMock(return_value=1)
    conn.fetchrow = AsyncMock(return_value={"id": 1})
    conn.fetch = AsyncMock(return_value=[])
    conn.execute = AsyncMock(return_value=None)
    return conn
```

### `mock_pg_pool`
```python
@pytest.fixture
def mock_pg_pool(mock_pg_conn):
    pool = MagicMock()
    acquire_ctx = MagicMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=mock_pg_conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=False)
    pool.acquire = MagicMock(return_value=acquire_ctx)
    return pool
```

### `async_client`
```python
@pytest_asyncio.fixture
async def async_client(mock_neo4j_driver, mock_pg_pool):
    from app.main import app
    from app.core.neo4j import Neo4jManager
    from app.core.postgres import PostgresManager
    from app.core import config as core_config

    with patch.object(Neo4jManager, "get_driver", return_value=mock_neo4j_driver), \
         patch.object(PostgresManager, "pool", return_value=mock_pg_pool), \
         patch.object(PostgresManager, "init", new_callable=AsyncMock), \
         patch.object(PostgresManager, "close", new_callable=AsyncMock), \
         patch.object(Neo4jManager, "close", new_callable=AsyncMock), \
         patch.object(core_config.settings, "api_key", ""):  # Dev 모드 강제
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
```

> `settings.api_key = ""`를 patch하여 인증 헤더 없이도 테스트 가능 (dev 모드).

## 단위 테스트 목록

### `test_models.py` (11개)

| 테스트 | 검증 내용 |
|--------|---------|
| `test_valid_minimal` | `EntityCreatedPayload` 최소 필드 |
| `test_valid_full` | `EntityCreatedPayload` 전체 필드 |
| `test_missing_entity_id_raises` | `entity_id` 누락 시 ValidationError |
| `test_missing_entity_type_raises` | `entity_type` 누락 시 ValidationError |
| `test_old_status_is_optional` | `StatusChangedPayload.old_status` Optional |
| `test_with_old_status` | `StatusChangedPayload` 전체 필드 |
| `test_relationship_valid` | `RelationshipEstablishedPayload` 최소 |
| `test_relationship_with_properties` | 관계 속성 포함 |
| `test_relationship_missing_rel_type_raises` | `rel_type` 누락 시 에러 |
| `test_attribute_changed_valid` | `AttributeChangedPayload` 최소 |
| `test_attribute_any_value_type` | new_value에 다양한 타입 |

### `test_projection_worker.py` (10개)

| 테스트 | 검증 내용 |
|--------|---------|
| `test_entity_created` | `EntityCreated` → `upsert_entity` 호출 확인 |
| `test_entity_created_no_name` | name 없는 EntityCreated |
| `test_entity_deleted` | `EntityDeleted` → `delete_entity` 호출 |
| `test_status_changed` | `StatusChanged` → `set_status` 호출 |
| `test_attribute_changed` | `AttributeChanged` → `set_attribute` 호출 |
| `test_relationship_established` | `RelationshipEstablished` → `upsert_relationship` 호출 |
| `test_relationship_removed` | `RelationshipRemoved` → `remove_relationship` 호출 |
| `test_device_status_changed_legacy` | 레거시 `DeviceStatusChanged` → `upsert_device` |
| `test_unknown_event_does_not_raise` | 미지원 이벤트 → 예외 없이 warning 로깅 |
| `test_invalid_payload_raises` | 잘못된 payload → ValidationError |

## E2E 테스트 목록

### `TestHealth` (1개)
- `test_health_ok` — `/health` 200, 필드 확인

### `TestEntitiesAPI` (8개)
- `test_create_entity_accepted` — `POST /entities` 202
- `test_create_entity_missing_field` — entity_type 누락 422
- `test_list_entities_default_pagination` — `GET /entities` 200, 페이지네이션 필드
- `test_list_entities_pagination_params` — page/size/entity_type 파라미터
- `test_list_entities_size_limit` — size=200 → 422
- `test_change_status_accepted` — `POST /entities/{id}/status` 202
- `test_delete_entity_requires_entity_type` — entity_type 없이 DELETE → 422
- `test_delete_entity_accepted` — `DELETE /entities/{id}?entity_type=Device` 202

### `TestRelationshipsAPI` (2개)
- `test_create_relationship_accepted` — `POST /relationships` 202
- `test_remove_relationship_accepted` — `DELETE /relationships` 202

### `TestLegacyAPI` (2개)
- `test_legacy_device_status` — `POST /devices/{id}/status` 202
- `test_legacy_list_devices` — `GET /devices` 200

### `TestOutboxStats` (1개)
- `test_outbox_stats` — `GET /outbox/stats` 200, 상태 키 확인

## 알려진 경고 (무시 가능)

```
PytestDeprecationWarning: The configuration option "asyncio_default_fixture_loop_scope" is unset.
```

pytest-asyncio 0.24 버전의 경고. 동작에 영향 없음. 해결방법:
```ini
# pytest.ini에 추가 시 경고 제거
asyncio_default_fixture_loop_scope = function
```

## 커버리지 현황

| 모듈 | 커버리지 | 비고 |
|------|---------|------|
| `app/models/events.py` | 100% | |
| `app/models/api.py` | 100% | |
| `app/core/config.py` | 100% | |
| `app/core/metrics.py` | 100% | |
| `app/core/auth.py` | ~80% | |
| `app/main.py` | ~57% | |
| `app/services/projection_worker.py` | ~49% | |
| `app/repositories/graph_repository.py` | ~29% | 실제 DB 미사용 |
| `app/core/neo4j.py` | ~57% | |
| `app/core/postgres.py` | ~56% | |
