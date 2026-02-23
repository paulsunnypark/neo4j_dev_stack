# Neo4j Dev Stack — 문서 목록

> 마지막 업데이트: 2026-02-23
> Git 브랜치: `main` | 최신 커밋: `ddaae65`

## 📁 문서 구조

| 파일 | 설명 |
|------|------|
| [01_architecture.md](01_architecture.md) | 전체 아키텍처 · 데이터 흐름 · 설계 결정 |
| [02_project_structure.md](02_project_structure.md) | 디렉토리/파일 구조 · 각 파일 역할 |
| [03_docker_ports.md](03_docker_ports.md) | Docker 구성 · 포트 매핑 · 환경변수 |
| [04_api_reference.md](04_api_reference.md) | FastAPI 엔드포인트 전체 명세 |
| [05_domain_model.md](05_domain_model.md) | Neo4j 도메인 모델 · 이벤트 타입 정의 |
| [06_database_schema.md](06_database_schema.md) | PostgreSQL 스키마 · Neo4j 제약 · 마이그레이션 |
| [07_testing.md](07_testing.md) | pytest 테스트 구조 · 실행 방법 · 픽스처 |
| [08_monitoring.md](08_monitoring.md) | Prometheus 메트릭 · Grafana 대시보드 · NeoDash |
| [09_dev_runbook.md](09_dev_runbook.md) | 개발 환경 시작/중지 · 자주 쓰는 명령어 |
| [10_session_log.md](10_session_log.md) | 세션별 작업 이력 · 해결한 이슈 |

## 🚀 빠른 시작 (TL;DR)

```powershell
# 1. Docker 전체 기동
cd E:\neo4j_dev_stack\docker
docker compose up -d

# 2. 마이그레이션 적용 (최초 1회 또는 변경 시)
cd E:\neo4j_dev_stack\backend
.venv\Scripts\python.exe scripts\apply_neo4j_migrations.py

# 3. FastAPI 시작
.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000

# 4. 테스트 실행
.venv\Scripts\python.exe -m pytest tests/ -v
```

## 🔑 접속 정보

| 서비스 | URL | 자격증명 |
|--------|-----|---------|
| FastAPI Docs | http://localhost:8000/docs | X-API-Key: `dev-secret-key-change-me` |
| Neo4j Browser | http://localhost:7477 | neo4j / neo4j_password_change_me |
| Grafana | http://localhost:3003 | admin / admin_change_me |
| NeoDash | http://localhost:5008 | (Neo4j 자격증명 사용) |
| Prometheus | http://localhost:9093 | — |
| Postgres | localhost:5435 | ha / ha_password_change_me (DB: ha_core) |
