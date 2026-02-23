# 06. 데이터베이스 스키마

## PostgreSQL 스키마

### `event_log` 테이블 (이벤트 원장)

```sql
CREATE TABLE IF NOT EXISTS event_log (
  id            BIGSERIAL PRIMARY KEY,
  event_type    TEXT NOT NULL,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor         TEXT,                    -- 발행자 식별자 (예: "api", "system")
  payload       JSONB NOT NULL           -- 이벤트 상세 데이터
);

CREATE INDEX IF NOT EXISTS idx_event_type_time
  ON event_log(event_type, occurred_at);
```

**특성:**
- 불변 (append-only) — 이벤트 수정/삭제 금지
- 감사 로그 및 이벤트 리플레이 용도
- `payload`는 각 이벤트 타입별 JSON (이벤트 타입별 구조는 [05_domain_model.md](05_domain_model.md) 참조)

---

### `outbox` 테이블 (투영 큐)

```sql
CREATE TABLE IF NOT EXISTS outbox (
  id            BIGSERIAL PRIMARY KEY,
  event_id      BIGINT NOT NULL REFERENCES event_log(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'PENDING',
                -- 상태: PENDING | PROCESSING | DONE | FAILED
  retry_count   INT  NOT NULL DEFAULT 0,
  last_error    TEXT,                    -- 마지막 실패 에러 메시지
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_created
  ON outbox(status, created_at);
```

**상태 전이:**
```
PENDING
  │
  ▼ (ProjectionWorker가 배치 선택, FOR UPDATE SKIP LOCKED)
PROCESSING
  │
  ├─ Neo4j 적용 성공 ──▶ DONE
  │
  └─ Neo4j 적용 실패 ──▶ FAILED
                          retry_count++
                          last_error = 에러 메시지
```

**FAILED 재처리:**
```sql
-- 수동으로 FAILED → PENDING 리셋
UPDATE outbox SET status='PENDING', retry_count=0, last_error=NULL
WHERE status='FAILED';
```

---

## EventRepository (Postgres 쓰기)

```python
# 트랜잭션으로 event_log + outbox 동시 삽입 (원자적)
async def append_event(event_type, payload, actor) -> int:
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "INSERT INTO event_log(event_type, actor, payload) "
                "VALUES($1,$2,$3) RETURNING id",
                event_type, actor, json.dumps(payload)
            )
            event_id = int(row["id"])
            await conn.execute(
                "INSERT INTO outbox(event_id, status) VALUES($1,'PENDING')",
                event_id
            )
            return event_id
```

---

## PostgreSQL 접속 정보

| 항목 | 값 |
|------|-----|
| Host | localhost |
| Port | **5435** |
| Database | ha_core |
| User | ha |
| Password | ha_password_change_me |
| 드라이버 | asyncpg 0.30.0 |
| 커넥션 풀 | min=1, max=10 |

---

## Neo4j 스키마

### 제약 및 인덱스 (`001_constraints.cypher`)

```cypher
-- Entity 유니크 제약
CREATE CONSTRAINT entity_id IF NOT EXISTS
FOR (e:Entity) REQUIRE e.id IS UNIQUE;

-- Entity 조회 인덱스
CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.entityType);
CREATE INDEX entity_status IF NOT EXISTS FOR (e:Entity) ON (e.status);

-- 하위 호환 Device 레이블 (레거시 데이터 지원)
CREATE CONSTRAINT device_id IF NOT EXISTS
FOR (d:Device) REQUIRE d.id IS UNIQUE;
CREATE INDEX device_status IF NOT EXISTS FOR (d:Device) ON (d.status);
```

### Neo4j 접속 정보

| 항목 | 값 |
|------|-----|
| URI | neo4j://localhost:7690 |
| User | neo4j |
| Password | neo4j_password_change_me |
| Database | neo4j (기본값) |
| 드라이버 | neo4j 5.28.1 (async) |
| 커넥션 풀 | max_connection_pool_size=50 |

---

## 마이그레이션 실행기

**파일:** `backend/scripts/apply_neo4j_migrations.py`

**동작:**
1. `backend/app/migrations/neo4j_*.cypher` 파일을 알파벳순 정렬
2. 각 파일을 `;` 로 구문 분리
3. `--` 로 시작하는 주석 라인 제거
4. 각 구문을 `session.execute_write()` 로 개별 실행
5. 멱등성 보장 (`IF NOT EXISTS`, `MERGE` 사용)

```powershell
# 실행 방법
cd E:\neo4j_dev_stack\backend
.venv\Scripts\python.exe scripts\apply_neo4j_migrations.py

# 출력 예시
APPLIED: neo4j_001_constraints.cypher (5 statements)
APPLIED: neo4j_002_seed.cypher (2 statements)
APPLIED: neo4j_003_neodash.cypher (1 statements)
```

**마이그레이션 파일 목록:**

| 파일 | 구문수 | 내용 |
|------|--------|------|
| `neo4j_001_constraints.cypher` | 5 | Entity/Device 제약 + 인덱스 |
| `neo4j_002_seed.cypher` | 2 | Entity-1 (Device), Entity-2 (Service) |
| `neo4j_003_neodash.cypher` | 1 | NeoDash 대시보드 노드 생성 |

> **새 마이그레이션 추가 시:** `neo4j_004_*.cypher` 형식으로 파일 생성 후 스크립트 재실행.
