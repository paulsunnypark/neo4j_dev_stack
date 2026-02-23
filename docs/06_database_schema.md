# 06. 데이터베이스 스키마

## PostgreSQL 스키마

### `event_log`

```sql
CREATE TABLE IF NOT EXISTS event_log (
  id          BIGSERIAL PRIMARY KEY,
  event_type  TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor       TEXT,
  payload     JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_type_time
  ON event_log(event_type, occurred_at);
```

### `outbox`

```sql
CREATE TABLE IF NOT EXISTS outbox (
  id          BIGSERIAL PRIMARY KEY,
  event_id    BIGINT NOT NULL REFERENCES event_log(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'PENDING',
  retry_count INT  NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_created
  ON outbox(status, created_at);
```

## PostgreSQL 접속 정보

| 항목 | 값 |
|------|-----|
| Host | localhost |
| Port | 5435 |
| DB | ha_core |
| User | ha |
| Password | ha_password_change_me |

## Neo4j 스키마

### 제약/인덱스 (`neo4j_001_constraints.cypher` + `neo4j_004_project_tenancy.cypher`)

```cypher
-- project tenant 복합 유니크
CREATE CONSTRAINT entity_project_id IF NOT EXISTS
FOR (e:Entity) REQUIRE (e.projectId, e.id) IS UNIQUE;

CREATE INDEX entity_project IF NOT EXISTS FOR (e:Entity) ON (e.projectId);
CREATE INDEX entity_project_type IF NOT EXISTS FOR (e:Entity) ON (e.projectId, e.entityType);
CREATE INDEX entity_project_status IF NOT EXISTS FOR (e:Entity) ON (e.projectId, e.status);

CREATE CONSTRAINT device_id IF NOT EXISTS
FOR (d:Device) REQUIRE d.id IS UNIQUE;
CREATE INDEX device_status IF NOT EXISTS FOR (d:Device) ON (d.status);
```

## Neo4j 접근 정보

### 테넌시 규칙

- 모든 API payload/query에 `project_id` 필수
- 그래프 노드 키는 `(projectId, id)` 복합키
- 동일 `id`라도 `project_id`가 다르면 공존 가능

### 사용자(브라우저) 접속

| 항목 | 값 |
|------|-----|
| 접속 주소 | http://localhost:5008 |
| 도구 | NeoDash |
| Username | neo4j |
| Password | neo4j_password_change_me |

### 백엔드 내부 연결 설정

| 항목 | 값 |
|------|-----|
| NEO4J_URI | bolt://localhost:17687 |
| NEO4J_DATABASE | neo4j |
| 드라이버 | neo4j python driver 5.28.1 |

## 마이그레이션 실행

```powershell
cd D:\neo4j_dev_stack\backend
.\.venv\Scripts\python.exe scripts\apply_neo4j_migrations.py
```

예상 출력:

```text
APPLIED: neo4j_001_constraints.cypher (5 statements)
APPLIED: neo4j_002_seed.cypher (2 statements)
APPLIED: neo4j_003_neodash.cypher (1 statements)
APPLIED: neo4j_004_project_tenancy.cypher (5 statements)
```
