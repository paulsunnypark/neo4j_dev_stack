# 08. 모니터링

## 구성 요약

```
FastAPI (/metrics) ─────────┐
                             ├──▶ Prometheus (9093) ──▶ Grafana (3003)
Neo4j (:2007)   ────────────┘
```

## Prometheus 메트릭

### FastAPI 커스텀 메트릭 (`app/core/metrics.py`)

```python
from prometheus_client import Counter, Gauge, make_asgi_app

OUTBOX_PROCESSED = Counter(
    "outbox_processed_total",
    "ProjectionWorker가 성공 처리한 이벤트 수",
    ["event_type"]
)

OUTBOX_FAILED = Counter(
    "outbox_failed_total",
    "ProjectionWorker가 실패한 이벤트 수",
    ["event_type"]
)

OUTBOX_PENDING = Gauge(
    "outbox_pending_count",
    "현재 PENDING 상태인 outbox 항목 수"
)

metrics_app = make_asgi_app()  # app.mount("/metrics", metrics_app)
```

**메트릭 업데이트 시점:**

- `OUTBOX_PROCESSED`, `OUTBOX_FAILED`: `ProjectionWorker._process_batch()` 내 각 이벤트 처리 후
- `OUTBOX_PENDING`: `GET /health` 호출 시 Postgres 직접 조회

### Neo4j 내장 메트릭 (`:2007/metrics`)

- `neo4j_transaction_committed_total`
- `neo4j_transaction_rolled_back_total`
- `neo4j_page_cache_hit_ratio`
- `neo4j_vm_heap_used`
- `neo4j_vm_heap_committed`
- `neo4j_bolt_connections_running`
- `neo4j_bolt_connections_opened_total`
- `neo4j_store_size_total`

---

## Grafana 대시보드

**접속:** http://localhost:3003
**자격증명:** admin / admin_change_me

### 자동 프로비저닝 구조

```
docker/monitoring/grafana/
├── provisioning/
│   ├── datasources/prometheus.yml    ← Prometheus 데이터소스 자동 등록
│   └── dashboards/dashboards.yml     ← 대시보드 경로 설정
└── dashboards/
    └── neo4j_overview.json           ← 실제 대시보드
```

#### `provisioning/datasources/prometheus.yml`

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    url: http://neo4j_dev_prometheus:9090
    isDefault: true
    access: proxy
    editable: false
```

#### `provisioning/dashboards/dashboards.yml`

```yaml
apiVersion: 1
providers:
  - name: default
    type: file
    options:
      path: /var/lib/grafana/dashboards
    updateIntervalSeconds: 30
```

### `neo4j_overview.json` — 9개 패널 구성

| ID  | 제목                             | 타입       | PromQL                                          |
| --- | -------------------------------- | ---------- | ----------------------------------------------- |
| 1   | Outbox — Pending                 | Stat       | `outbox_pending_count`                          |
| 2   | Outbox — 처리 속도 (건/분)       | Timeseries | `rate(outbox_processed_total[1m]) * 60`         |
| 3   | Outbox — 실패 누계               | Stat       | `sum(outbox_failed_total) or vector(0)`         |
| 4   | Outbox — 이벤트 타입별 실패      | Timeseries | `rate(outbox_failed_total[5m]) * 60`            |
| 5   | Neo4j — Transactions Committed/s | Timeseries | `rate(neo4j_transaction_committed_total[1m])`   |
| 6   | Neo4j — Page Cache Hit Ratio     | Gauge      | `neo4j_page_cache_hit_ratio`                    |
| 7   | Neo4j — Heap Memory              | Timeseries | `neo4j_vm_heap_used`, `neo4j_vm_heap_committed` |
| 8   | Neo4j — Active Bolt Connections  | Timeseries | `neo4j_bolt_connections_running`                |
| 9   | Neo4j — Store Sizes              | Timeseries | `neo4j_store_size_total`                        |

**대시보드 설정:**

- UID: `neo4j-dev-overview`
- 자동 새로고침: 10초
- 기본 시간 범위: 최근 1시간
- 타임존: browser

**임계값:**

- Outbox Pending: 노란색 ≥10, 빨간색 ≥50
- Outbox Failed: 빨간색 ≥1 (즉시 알림)
- Page Cache Hit Ratio: 빨간색 <0.80, 노란색 <0.95, 초록색 ≥0.95

---

## NeoDash 대시보드

**접속:** http://localhost:5008
**자격증명:** Neo4j 계정 사용 (neo4j / neo4j_password_change_me)

멀티 프로젝트 운영 시:

- 각 리포트 쿼리에 `WHERE e.projectId = '<project_id>'` 필터를 추가
- 기본 seed 쿼리는 전역 집계이므로 프로젝트별 관찰이 필요하면 복제 후 필터링

### 자동 로드 (`neo4j_003_neodash.cypher`)

```cypher
MERGE (d:_Neodash_Dashboard {uuid: "neo4j-dev-overview"})
SET d.title = "Neo4j Dev Stack Overview",
    d.version = "2.4",
    ...
```

NeoDash는 시작 시 Neo4j의 `_Neodash_Dashboard` 노드를 읽어 대시보드를 로드.

### 페이지 1: Overview (4개 패널)

| ID  | 제목                      | 타입  | Cypher                                                            |
| --- | ------------------------- | ----- | ----------------------------------------------------------------- |
| 1   | Total Entities            | Value | `MATCH (e:Entity) RETURN count(e) AS Total`                       |
| 2   | Entities by Type          | Bar   | `MATCH (e:Entity) RETURN e.entityType AS Type, count(e) AS Count` |
| 3   | Entity Relationship Graph | Graph | `MATCH path=(a:Entity)-[r]->(b:Entity) RETURN path LIMIT 50`      |
| 4   | Recent Entities           | Table | `MATCH (e:Entity) RETURN ... ORDER BY e.updatedAt DESC LIMIT 20`  |

### 페이지 2: Relationships (3개 패널)

| ID  | 제목                     | 타입  | Cypher                                 |
| --- | ------------------------ | ----- | -------------------------------------- |
| 5   | Relationship Types       | Bar   | 관계 타입별 카운트                     |
| 6   | Online / Active Entities | Pie   | status=ONLINE/RUNNING/ACTIVE 인 Entity |
| 7   | Full Graph (LIMIT 100)   | Graph | 전체 Entity 그래프 시각화              |

---

## 알람/임계값 설정 가이드

```
Outbox Pending ≥ 50   → Neo4j 또는 ProjectionWorker 확인
Outbox Failed ≥ 1     → 이벤트 재처리 또는 Neo4j 쿼리 오류 확인
Page Cache Hit < 0.80 → Neo4j 메모리 증설 고려 (pagecache_size 증가)
Heap Used > 900MB     → JVM 힙 설정 검토 (heap_max_size 증가)
```

## Troubleshooting (NeoDash)

### 🚨 `RangeError: Maximum call stack size exceeded` (하얀 화면 또는 Connect 직후 크래시)

NeoDash 2.4 엔진은 Neo4j에서 **다중 라벨(Multi-Label)이 중첩된 노드 스키마**를 읽어들일 때 Autocomplete 사전을 생성하다가 무한 루프(Stack Overflow)에 빠지는 치명적인 버그가 있습니다. (예: `(:Device:EndDevice)` 처럼 2개 이상의 의미론적 라벨을 동시에 가진 경우)

**해결 방법:**

1. **스키마 물리적 정리:** Neo4j DB를 스캔하여 다중 라벨을 사용 중인 데이터 생성 로직(Backend 로직)을 찾아 **단일 라벨(Single-Label)**로 변경해야 합니다. (예: `Device` 라벨만 부여하고 상세 타입은 `device_type` 속성으로 관리)
2. **복구(DB 초기화):** 아래 스크립트로 DB의 모든 데이터를 지워 엉킨 스키마 캐시를 비워야 합니다.
   ```cypher
   MATCH (n) DETACH DELETE n;
   ```
3. **접속 초기화 (캐시 삭제):** 브라우저 캐시(Local Storage)에 부서진 스키마 찌꺼기가 남아 계속 크래시를 유발하므로, **시크릿 창(Incognito)**을 열고 `http://localhost:5008` 에 접속한 뒤 포트번호를 `17687`로 설정하여 재접속해야 합니다.
