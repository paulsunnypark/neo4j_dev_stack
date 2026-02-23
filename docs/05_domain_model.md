# 05. 도메인 모델 (Neo4j)

## 노드 설계: 단일 레이블 + entityType 속성

```cypher
(:Entity {
  id:         String    -- UNIQUE, 필수
  entityType: String    -- "Device" | "Service" | "User" | "Location" | ...
  name:       String?
  status:     String?   -- "ONLINE" | "OFFLINE" | "RUNNING" | "FAILED" | ...
  updatedAt:  DateTime  -- 마지막 업데이트 (자동 설정)
  ...                   -- 도메인별 임의 속성 추가 가능
})
```

**선택 이유:** APOC 없이 동작, 쿼리 단순, 다양한 도메인에 범용 적용 가능.

### 기존 방식과 비교

| 방식 | 예시 | 장점 | 단점 |
|------|------|------|------|
| 동적 다중 레이블 (APOC 필요) | `(:Device:SmartHome)` | 레이블별 인덱스 | APOC 의존, 관리 복잡 |
| **단일 레이블 + 속성** (현재) | `(:Entity {entityType:"Device"})` | 심플, APOC 불필요 | entityType 인덱스 필요 |

## 관계 설계

```cypher
(:Entity)-[:REL_TYPE {
  updatedAt:  DateTime  -- 자동 설정
  ...properties         -- 도메인별 임의 속성
}]->(:Entity)
```

**관계 타입 예시:**
- `DEPENDS_ON` — 서비스 의존성
- `CONNECTED_TO` — 물리적/논리적 연결
- `MANAGES` — 관리 관계
- `OWNS` — 소유 관계
- `LOCATED_IN` — 위치 관계

## Neo4j 제약 및 인덱스

```cypher
-- 001_constraints.cypher 에서 정의

-- 유니크 제약
CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE;

-- 조회 성능 인덱스
CREATE INDEX entity_type IF NOT EXISTS FOR (e:Entity) ON (e.entityType);
CREATE INDEX entity_status IF NOT EXISTS FOR (e:Entity) ON (e.status);

-- 하위 호환 (기존 Device 레이블)
CREATE CONSTRAINT device_id IF NOT EXISTS FOR (d:Device) REQUIRE d.id IS UNIQUE;
CREATE INDEX device_status IF NOT EXISTS FOR (d:Device) ON (d.status);
```

## 이벤트 타입 (6종 + 1 레거시)

모든 이벤트는 `event_log` → `outbox` → `ProjectionWorker` → Neo4j 경로로 처리.

### 1. `EntityCreated`
```python
class EntityCreatedPayload(BaseModel):
    entity_id: str
    entity_type: str
    name: Optional[str] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)
```

**Neo4j 효과:**
```cypher
MERGE (e:Entity {id: $entity_id})
SET e.entityType = $entity_type,
    e.updatedAt  = datetime()
SET e.name = $name, e.attr1 = $val1, ...
```

---

### 2. `EntityDeleted`
```python
class EntityDeletedPayload(BaseModel):
    entity_id: str
    entity_type: str
```

**Neo4j 효과:**
```cypher
MATCH (e:Entity {id: $entity_id}) DETACH DELETE e
```
> 연결된 모든 관계도 함께 삭제됨.

---

### 3. `AttributeChanged`
```python
class AttributeChangedPayload(BaseModel):
    entity_id: str
    entity_type: str
    attribute_key: str
    old_value: Optional[Any] = None  # 감사 로그용 (Neo4j에는 new_value만 적용)
    new_value: Any
```

**Neo4j 효과:**
```cypher
MATCH (e:Entity {id: $entity_id})
SET e[$key] = $value, e.updatedAt = datetime()
```
> Neo4j 5.x의 동적 속성 접근(`e[$key]`) 사용.

---

### 4. `RelationshipEstablished`
```python
class RelationshipEstablishedPayload(BaseModel):
    from_id: str
    from_type: str
    to_id: str
    to_type: str
    rel_type: str
    properties: Dict[str, Any] = Field(default_factory=dict)
```

**Neo4j 효과 (APOC 우선, fallback 정적 MERGE):**
```cypher
-- APOC 시도
MATCH (a:Entity {id: $from_id}), (b:Entity {id: $to_id})
CALL apoc.merge.relationship(a, $rel_type, {}, $props, b, {})
YIELD rel SET rel.updatedAt = datetime()

-- APOC 실패 시 fallback
MATCH (a:Entity {id: $from_id}), (b:Entity {id: $to_id})
MERGE (a)-[r:`DEPENDS_ON`]->(b)
SET r += $props, r.updatedAt = datetime()
```

---

### 5. `RelationshipRemoved`
```python
class RelationshipRemovedPayload(BaseModel):
    from_id: str
    from_type: str
    to_id: str
    to_type: str
    rel_type: str
```

**Neo4j 효과:**
```cypher
MATCH (a:Entity {id: $from_id})-[r:`DEPENDS_ON`]->(b:Entity {id: $to_id})
DELETE r
```

---

### 6. `StatusChanged`
```python
class StatusChangedPayload(BaseModel):
    entity_id: str
    entity_type: str
    old_status: Optional[str] = None  # 감사 로그용
    new_status: str
```

**Neo4j 효과:**
```cypher
MATCH (e:Entity {id: $entity_id})
SET e.status = $status, e.updatedAt = datetime()
```

---

### 레거시: `DeviceStatusChanged` (하위 호환)
```python
# projection_worker.py 내 처리
device_id = payload["device_id"]
status    = payload["status"]
name      = payload.get("name", device_id)
await graph_repo.upsert_device(device_id, name, status)
# → upsert_entity(entity_id=device_id, entity_type="Device", name=name, attributes={"status": status})
```

## GraphRepository 메서드 전체 목록

```python
class GraphRepository:
    # 범용 쿼리
    async def run_read(cypher, params?) -> List[Dict]
    async def run_write(cypher, params?) -> None

    # Entity CRUD
    async def upsert_entity(entity_id, entity_type, name?, attributes?) -> None
    async def delete_entity(entity_id) -> None
    async def set_attribute(entity_id, key, value) -> None
    async def set_status(entity_id, new_status) -> None

    # 관계
    async def upsert_relationship(from_id, to_id, rel_type, properties?) -> None
    async def remove_relationship(from_id, to_id, rel_type) -> None

    # 조회
    async def list_entities(entity_type?, page, size) -> List[Dict]
    async def count_entities(entity_type?) -> int

    # 하위 호환
    async def upsert_device(device_id, name, status) -> None
```

## Neo4j DateTime 직렬화

Neo4j가 반환하는 `neo4j.time.DateTime` 객체는 FastAPI/Pydantic에서 JSON 직렬화 불가.
`_sanitize()` 함수로 ISO 문자열로 변환:

```python
def _sanitize(value: Any) -> Any:
    from neo4j.time import DateTime, Date, Time, Duration
    if isinstance(value, (DateTime, Date, Time, Duration)):
        return str(value)  # "2026-02-23T07:01:32.832000000+00:00"
    if isinstance(value, dict):
        return {k: _sanitize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize(v) for v in value]
    return value
```

모든 `run_read` 결과에 자동 적용됨.

## 시드 데이터 (002_seed.cypher)

```cypher
MERGE (e:Entity {id: "entity-1"})
SET e.entityType = "Device", e.name = "Device 1",
    e.status = "ONLINE", e.updatedAt = datetime();

MERGE (e:Entity {id: "entity-2"})
SET e.entityType = "Service", e.name = "Service 1",
    e.status = "RUNNING", e.updatedAt = datetime();
```
