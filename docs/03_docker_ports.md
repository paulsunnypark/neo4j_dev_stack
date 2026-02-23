# 03. Docker 구성 및 포트

## 프로젝트 정보

```yaml
name: neo4j_dev          # docker compose 프로젝트명
                         # 볼륨명: neo4j_dev_neo4j_data 등으로 네임스페이스됨
```

## 포트 매핑 전체 목록

| 서비스 | 컨테이너명 | 로컬 포트 | 컨테이너 내부 포트 | 용도 |
|--------|-----------|---------|----------------|------|
| Neo4j | neo4j_dev_neo4j | **7477** | 7474 | Neo4j Browser (HTTP) |
| Neo4j | neo4j_dev_neo4j | **7690** | 7687 | Bolt 프로토콜 |
| Neo4j | neo4j_dev_neo4j | **2007** | 2004 | Prometheus 메트릭 |
| PostgreSQL | neo4j_dev_postgres | **5435** | 5432 | SQL |
| NeoDash | neo4j_dev_neodash | **5008** | 5005 | Web UI |
| Prometheus | neo4j_dev_prometheus | **9093** | 9090 | Web UI + API |
| Grafana | neo4j_dev_grafana | **3003** | 3000 | Web UI |
| FastAPI | (호스트 직접) | **8000** | — | REST API |

> **포트 설계 원칙:** 기본 포트 +3으로 오프셋 적용하여 다른 프로젝트와 충돌 방지.

## 기존 포트와 비교

| 서비스 | 기존 (neo4j_dev_spec) | 현재 (neo4j_dev) | 변경량 |
|--------|----------------------|-----------------|--------|
| Neo4j Browser | 7474 | 7477 | +3 |
| Neo4j Bolt | 7687 | 7690 | +3 |
| Neo4j Metrics | 2004 | 2007 | +3 |
| Postgres | 5432 | 5435 | +3 |
| NeoDash | 5005 | 5008 | +3 |
| Prometheus | 9090 | 9093 | +3 |
| Grafana | 3000 | 3003 | +3 |

## 서비스별 환경변수

### Neo4j
```yaml
NEO4J_AUTH: neo4j/neo4j_password_change_me
NEO4J_PLUGINS: ["apoc","n10s"]           # GDS 제거 (5.26 community 미지원)
NEO4J_dbms_security_procedures_unrestricted: apoc.*,n10s.*,semantics.*
NEO4J_dbms_security_procedures_allowlist: apoc.*,n10s.*,semantics.*
NEO4J_server_memory_heap_initial__size: 512m
NEO4J_server_memory_heap_max__size: 1G
NEO4J_server_memory_pagecache_size: 512m
NEO4J_server_config_strict__validation_enabled: false  # 미지원 설정 무시
NEO4J_server_metrics_enabled: true
NEO4J_server_metrics_prometheus_enabled: true
NEO4J_server_metrics_prometheus_endpoint: 0.0.0.0:2004
NEO4J_db_logs_query_enabled: INFO
NEO4J_db_logs_query_threshold: 500ms
```

### PostgreSQL
```yaml
POSTGRES_DB: ha_core
POSTGRES_USER: ha
POSTGRES_PASSWORD: ha_password_change_me
```

초기화 스크립트 (`./postgres/init/` → 컨테이너 `/docker-entrypoint-initdb.d/`):
- `001_schema.sql` — event_log + outbox 테이블
- `002_seed.sql` — 초기 데이터 (현재 비어있음)

### NeoDash
```yaml
ssoEnabled: false
standalone: true
standaloneProtocol: neo4j
standaloneHost: neo4j_dev_neo4j     # 컨테이너명으로 연결
standalonePort: 7687
standaloneDatabase: neo4j
standaloneUsername: neo4j
standalonePassword: neo4j_password_change_me
```

### Grafana
```yaml
GF_SECURITY_ADMIN_PASSWORD: admin_change_me
GF_USERS_ALLOW_SIGN_UP: false
```

볼륨:
- `./monitoring/grafana/provisioning:/etc/grafana/provisioning:ro` — Datasource + Dashboard 자동 등록
- `./monitoring/grafana/dashboards:/var/lib/grafana/dashboards:ro` — 대시보드 JSON

## 볼륨 목록

```yaml
volumes:
  neo4j_data:     # Neo4j 데이터
  neo4j_logs:     # Neo4j 로그
  neo4j_plugins:  # Neo4j APOC/n10s 플러그인 캐시
  pg_data:        # PostgreSQL 데이터
  grafana_data:   # Grafana 대시보드/설정 (프로비저닝은 ro 마운트)
```

> **주의:** 볼륨을 삭제하면 모든 데이터가 초기화됩니다.
> Neo4j 관련 3개 볼륨을 삭제해야 할 경우 마이그레이션 재적용 필요.

## 서비스 의존성

```
neo4j (healthy) ──┬──▶ neodash
                  └──▶ prometheus ──▶ grafana
postgres (healthy)
```

## .env 파일 (backend/.env)

```dotenv
# Neo4j (새 포트)
NEO4J_URI=neo4j://localhost:7690
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j_password_change_me
NEO4J_DATABASE=neo4j

# PostgreSQL (새 포트)
PG_HOST=localhost
PG_PORT=5435
PG_DB=ha_core
PG_USER=ha
PG_PASSWORD=ha_password_change_me

# API 인증 (비어있으면 dev 모드 — 인증 생략)
API_KEY=dev-secret-key-change-me

# 로깅
LOG_LEVEL=INFO
```

> **테스트 시:** `conftest.py`에서 `settings.api_key = ""`로 패치하여 dev 모드 강제.

## Prometheus 스크레이프 설정

```yaml
global:
  scrape_interval: 10s

scrape_configs:
  - job_name: 'neo4j'
    static_configs:
      - targets: ['neo4j_dev_neo4j:2004']   # Docker 내부 네트워크

  - job_name: 'fastapi'
    static_configs:
      - targets: ['host.docker.internal:8000']  # 호스트의 FastAPI
    metrics_path: /metrics
```
