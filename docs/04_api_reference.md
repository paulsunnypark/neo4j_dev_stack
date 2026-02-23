# 04. FastAPI API 레퍼런스

**Base URL:** `http://localhost:8000`
**Docs UI:** `http://localhost:8000/docs`
**Auth:** `X-API-Key: <api_key>` 헤더 (`.env`의 `API_KEY=` 비어있으면 생략 가능)

---

## 인증 방식

| `API_KEY` 값 | 동작 |
|------------|------|
| 비어있음 (`""`) | **Dev 모드** — 인증 헤더 없어도 모든 엔드포인트 접근 가능 |
| 설정됨 | `X-API-Key` 헤더 필수. 불일치 시 `403 Forbidden` |

```http
X-API-Key: dev-secret-key-change-me
```

---

## 공통 응답 모델

### `EventQueued` (202 Accepted)
```json
{
  "event_id": 42,
  "note": "Queued for projection"
}
```

### `PagedResponse` (200 OK)
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "size": 20,
  "pages": 5
}
```

### `ErrorResponse` (4xx / 500)
```json
{
  "error": "Internal Server Error",
  "detail": "...",
  "code": null
}
```

### `HealthResponse` (200 OK)
```json
{
  "ok": true,
  "neo4j": true,
  "postgres": true,
  "version": "1.0.0"
}
```

---

## Ops 엔드포인트

### `GET /health`
Neo4j, Postgres 연결 상태 확인. 인증 불필요.
부수효과: `OUTBOX_PENDING` Gauge를 현재 PENDING 카운트로 업데이트.

**Response 200:**
```json
{"ok": true, "neo4j": true, "postgres": true, "version": "1.0.0"}
```

---

### `GET /metrics`
Prometheus 메트릭 노출 (prometheus-client `make_asgi_app()` 마운트).
인증 불필요. Prometheus scrape 전용.

**메트릭 목록:**
| 메트릭명 | 타입 | 레이블 | 설명 |
|---------|------|--------|------|
| `outbox_processed_total` | Counter | `event_type` | 성공 처리된 이벤트 수 |
| `outbox_failed_total` | Counter | `event_type` | 실패한 이벤트 수 |
| `outbox_pending_count` | Gauge | — | 현재 PENDING 건수 (/health 호출 시 갱신) |

---

### `GET /outbox/stats`
Outbox 상태별 카운트 (Postgres 직접 조회). 인증 필요.

**Response 200:**
```json
{
  "DONE": 150,
  "PENDING": 2,
  "FAILED": 1
}
```

---

## Entity API

### `POST /entities` — Entity 생성
**인증 필요** | **응답 202**

**Request Body:**
```json
{
  "entity_id": "dev-001",
  "entity_type": "Device",
  "name": "Living Room Sensor",
  "attributes": {
    "location": "room-1",
    "version": "2.0"
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `entity_id` | string | ✅ | 고유 식별자 |
| `entity_type` | string | ✅ | 엔티티 종류 (Device, Service, User 등) |
| `name` | string | — | 표시명 |
| `attributes` | object | — | 추가 속성 딕셔너리 |

**동작:** `EntityCreated` 이벤트 발행 → Outbox → Neo4j `MERGE (:Entity {id})` + SET 속성

---

### `GET /entities` — Entity 목록 (페이지네이션)
**인증 필요** | **응답 200**

**Query Parameters:**
| 파라미터 | 기본값 | 설명 |
|---------|--------|------|
| `entity_type` | — | 필터 (예: `Device`, `Service`) |
| `page` | 1 | 페이지 번호 (≥1) |
| `size` | 20 | 페이지 크기 (1~100) |

```http
GET /entities?entity_type=Device&page=1&size=10
```

**Response 200:**
```json
{
  "items": [
    {
      "id": "dev-001",
      "entityType": "Device",
      "name": "Living Room Sensor",
      "status": "ONLINE",
      "location": "room-1",
      "updatedAt": "2026-02-23T07:01:32.832000000+00:00"
    }
  ],
  "total": 2,
  "page": 1,
  "size": 10,
  "pages": 1
}
```

> `updatedAt`은 Neo4j `DateTime`을 ISO 문자열로 변환 (`_sanitize()` 함수).

---

### `DELETE /entities/{entity_id}` — Entity 삭제
**인증 필요** | **응답 202**

**Query Parameter (필수):**
| 파라미터 | 설명 |
|---------|------|
| `entity_type` | 삭제할 엔티티 타입 |

```http
DELETE /entities/dev-001?entity_type=Device
```

**동작:** `EntityDeleted` 이벤트 → `DETACH DELETE` (모든 관계 포함 삭제)

---

### `POST /entities/{entity_id}/status` — 상태 변경
**인증 필요** | **응답 202**

**Request Body:**
```json
{
  "entity_id": "dev-001",
  "entity_type": "Device",
  "old_status": "ONLINE",
  "new_status": "OFFLINE"
}
```

> `entity_id`는 path에서도 받지만, body의 `entity_id`로 덮어씀 (body 우선).

---

### `POST /entities/{entity_id}/attributes` — 속성 변경
**인증 필요** | **응답 202**

**Request Body:**
```json
{
  "entity_id": "dev-001",
  "entity_type": "Device",
  "attribute_key": "firmware_version",
  "old_value": "1.0",
  "new_value": "2.0"
}
```

**동작:** `AttributeChanged` 이벤트 → `SET e[$key] = $value` (Neo4j 5.x 동적 속성)

---

## Relationship API

### `POST /relationships` — 관계 생성
**인증 필요** | **응답 202**

**Request Body:**
```json
{
  "from_id": "dev-001",
  "from_type": "Device",
  "to_id": "svc-001",
  "to_type": "Service",
  "rel_type": "DEPENDS_ON",
  "properties": {
    "since": "2026-01",
    "priority": "high"
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `from_id` | string | ✅ | 시작 노드 ID |
| `from_type` | string | ✅ | 시작 노드 entityType |
| `to_id` | string | ✅ | 끝 노드 ID |
| `to_type` | string | ✅ | 끝 노드 entityType |
| `rel_type` | string | ✅ | 관계 타입 (예: DEPENDS_ON) |
| `properties` | object | — | 관계 속성 |

**동작:** `RelationshipEstablished` 이벤트 → APOC `apoc.merge.relationship` 또는 정적 MERGE fallback

---

### `DELETE /relationships` — 관계 삭제
**인증 필요** | **응답 202**

**Request Body:**
```json
{
  "from_id": "dev-001",
  "from_type": "Device",
  "to_id": "svc-001",
  "to_type": "Service",
  "rel_type": "DEPENDS_ON"
}
```

---

## Legacy API (하위 호환)

> ⚠️ 레거시 엔드포인트. 새 코드에서는 `/entities` 사용 권장.

### `POST /devices/{device_id}/status`
인증 불필요. `DeviceStatusChanged` 이벤트 발행.

```json
{"status": "OFFLINE"}
```

**Response 202:**
```json
{
  "device_id": "dev-1",
  "event_id": 5,
  "note": "Queued for projection"
}
```

---

### `GET /devices`
Neo4j에서 `entityType='Device'` 인 Entity 목록 직접 조회.

**Response 200:**
```json
[
  {"id": "dev-001", "name": "Sensor Alpha", "status": "OFFLINE"},
  {"id": "dev-002", "name": "Sensor Beta", "status": "ONLINE"}
]
```

---

## PowerShell 예제

```powershell
$headers = @{'X-API-Key' = 'dev-secret-key-change-me'; 'Content-Type' = 'application/json'}

# Entity 생성
Invoke-RestMethod -Uri http://localhost:8000/entities -Method POST -Headers $headers `
  -Body '{"entity_id":"svc-1","entity_type":"Service","name":"My Service","attributes":{"version":"2.0"}}'

# 관계 생성
Invoke-RestMethod -Uri http://localhost:8000/relationships -Method POST -Headers $headers `
  -Body '{"from_id":"dev-10","from_type":"Device","to_id":"svc-1","to_type":"Service","rel_type":"DEPENDS_ON"}'

# 목록 조회
Invoke-RestMethod -Uri "http://localhost:8000/entities?entity_type=Device&page=1&size=10" -Headers $headers

# 상태 변경
Invoke-RestMethod -Uri http://localhost:8000/entities/dev-10/status -Method POST -Headers $headers `
  -Body '{"entity_id":"dev-10","entity_type":"Device","new_status":"OFFLINE"}'

# 헬스 체크
Invoke-RestMethod -Uri http://localhost:8000/health

# Outbox 통계
Invoke-RestMethod -Uri http://localhost:8000/outbox/stats -Headers $headers
```
