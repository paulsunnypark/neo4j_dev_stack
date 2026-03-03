# Neo4j Dev Stack - 문서 인덱스

> 마지막 업데이트: 2026-03-03

## 문서 목록

| 파일 | 설명 |
|------|------|
| [01_architecture.md](01_architecture.md) | 아키텍처/데이터 흐름 |
| [02_project_structure.md](02_project_structure.md) | 디렉토리 구조 |
| [03_docker_ports.md](03_docker_ports.md) | Docker 설정/포트/환경변수 |
| [04_api_reference.md](04_api_reference.md) | FastAPI API 명세 (`project_id` 필수) |
| [05_domain_model.md](05_domain_model.md) | 도메인 모델/이벤트 타입 (`project_id` 격리) |
| [06_database_schema.md](06_database_schema.md) | DB 스키마/마이그레이션 |
| [07_testing.md](07_testing.md) | 테스트 구조/실행 |
| [08_monitoring.md](08_monitoring.md) | Prometheus/Grafana/NeoDash |
| [09_dev_runbook.md](09_dev_runbook.md) | 운영/개발 런북 |
| [10_session_log.md](10_session_log.md) | 작업 이력(참고용) |
| [11_multi_project_playbook.md](11_multi_project_playbook.md) | 고난도/다중 프로젝트 개발 절차 |
| [12_frontend_upgrade_2026-02-27.md](12_frontend_upgrade_2026-02-27.md) | neo_stacker 프론트엔드 업그레이드 결과 보고 |
| [13_stack_upgrade_next_steps_2026-02-27.md](13_stack_upgrade_next_steps_2026-02-27.md) | backend/docker/docs 업그레이드 연계 및 다음 단계 |
| [14_cross_repo_local_validation_2026-03-03.md](14_cross_repo_local_validation_2026-03-03.md) | 최신 코드베이스 동기화/도커 구동/통합 검증 결과 |
| [15_aura_lightweight_profile_validation_2026-03-03.md](15_aura_lightweight_profile_validation_2026-03-03.md) | Aura/경량화 프로필 분리 운영 검증 결과 |
| [16_naming_and_scope_clarification_2026-03-03.md](16_naming_and_scope_clarification_2026-03-03.md) | neo4j_dev_stack vs neo_stacker 명칭/범위 정리 |
| [17_hise_integration_contract_2026-03-03.md](17_hise_integration_contract_2026-03-03.md) | hi-se 연동 API 계약 및 배치 이벤트 규격 |

## 빠른 시작 (TL;DR)

```powershell
# 1) Python 환경 준비
cd D:\neo4j_dev_stack\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# 2) Docker 기동
cd ..\docker

# AuraDB mode (default)
Copy-Item .env.aura.example .env.aura
# .env.aura 값 수정 후
docker compose --env-file .env.aura up -d postgres backend frontend

# 3) 마이그레이션
cd ..\backend
.\.venv\Scripts\python.exe scripts\apply_neo4j_migrations.py

# 4) API 실행
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 접속 주소/로그인

| 서비스 | URL | 로그인/인증 |
|--------|-----|-------------|
| FastAPI Docs | http://localhost:8000/docs | `X-API-Key: dev-secret-key-change-me` |
| FastAPI Health | http://localhost:8000/health | 인증 불필요 |
| Frontend | http://localhost:5173 | 없음 |
| Postgres | `localhost:5435` | `ha` / `ha_password_change_me` (DB: `ha_core`) |

중요:
- AuraDB 사용 시 `.env.aura`를 사용해 명시적으로 연결값을 관리합니다.
- 기존 로컬 설치형 Neo4j 연동은 `.env.local` 프로필로 별도 관리할 수 있습니다.
- Aura의 데이터베이스명은 `neo4j`가 아닐 수 있으며, 인스턴스 ID와 동일한 값(예: `7445e7b0`)일 수 있습니다.
- 로컬 설치형 Neo4j는 Docker 스택에 포함하지 않으며, 필요할 때만 별도 프로세스로 준비합니다.
- API 기반 개발에서는 모든 요청에 `project_id`를 반드시 포함해야 합니다.
