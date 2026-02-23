# 03. Docker 구성 및 포트

## 프로젝트명

```yaml
name: neo4j_dev
```

## 포트 매핑

| 서비스 | 컨테이너 | 호스트 포트 | 컨테이너 포트 | 용도 |
|--------|----------|-------------|---------------|------|
| Neo4j Browser | neo4j_dev_neo4j | `7477` | `7474` | 웹 관리 UI |
| Neo4j Driver (로컬 전용) | neo4j_dev_neo4j | `127.0.0.1:17687` | `7687` | 백엔드/내부 드라이버 연결 |
| Neo4j Metrics | neo4j_dev_neo4j | `2007` | `2004` | Prometheus 수집 |
| PostgreSQL | neo4j_dev_postgres | `5435` | `5432` | SQL |
| NeoDash | neo4j_dev_neodash | `5008` | `5005` | 그래프 대시보드 (권장 접속점) |
| Prometheus | neo4j_dev_prometheus | `9093` | `9090` | 모니터링 |
| Grafana | neo4j_dev_grafana | `3003` | `3000` | 대시보드 |
| FastAPI | 호스트 프로세스 | `8000` | - | REST API |

## 현재 핵심 보안/접속 정책

- NeoDash 접속 주소: `http://localhost:5008`
- NeoDash 로그인: `neo4j / neo4j_password_change_me`
- NeoDash에는 평문 비밀번호를 설정 파일로 주입하지 않음
- Neo4j 드라이버 포트는 `127.0.0.1:17687`로 로컬 루프백에만 바인딩
- API 연동 시 모든 요청에 `project_id`를 필수로 포함

## 주요 환경변수

### Neo4j

```yaml
NEO4J_AUTH: neo4j/neo4j_password_change_me
NEO4J_server_bolt_advertised__address: localhost:17687
NEO4J_PLUGINS: ["apoc","n10s"]
NEO4J_dbms_security_procedures_unrestricted: apoc.*,n10s.*,semantics.*
NEO4J_dbms_security_procedures_allowlist: apoc.*,n10s.*,semantics.*
NEO4J_server_memory_heap_initial__size: 512m
NEO4J_server_memory_heap_max__size: 1G
NEO4J_server_memory_pagecache_size: 512m
NEO4J_server_config_strict__validation_enabled: false
NEO4J_db_logs_query_enabled: INFO
NEO4J_db_logs_query_threshold: 500ms
```

### NeoDash

```yaml
ssoEnabled: false
standalone: true
standaloneProtocol: bolt
standaloneHost: localhost
standalonePort: 17687
standaloneDatabase: neo4j
standaloneUsername: neo4j
# standalonePassword 미사용 (보안 경고 방지)
```

### backend/.env

```dotenv
NEO4J_URI=bolt://localhost:17687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j_password_change_me
NEO4J_DATABASE=neo4j

PG_HOST=localhost
PG_PORT=5435
PG_DB=ha_core
PG_USER=ha
PG_PASSWORD=ha_password_change_me

API_KEY=dev-secret-key-change-me
LOG_LEVEL=INFO
```

## 볼륨

- `neo4j_data`
- `neo4j_logs`
- `neo4j_plugins`
- `pg_data`
- `grafana_data`

## 점검 명령

```powershell
cd D:\neo4j_dev_stack\docker
docker compose ps
docker compose logs --tail 100 neo4j neodash
```
