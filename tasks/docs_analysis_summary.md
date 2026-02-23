# Neo4j Dev Stack - Docs Analysis Summary

## 1. 아키텍처 및 도메인 모델

- **구조**: FastAPI 기반 백엔드, PostgreSQL (이벤트 원장 및 Outbox 큐), Neo4j (그래프 데이터베이스)로 구성. 단일 프로세스 환경.
- **CQRS / Outbox 패턴**: Write 요청은 Postgres의 `event_log`와 `outbox` 테이블에 원자적(Transactional)으로 기록되고, 백그라운드 태스크인 `ProjectionWorker`가 이를 읽어 Neo4j에 그래프 형태로 투영함 (최종 일관성).
- **도메인 모델**: 단일 `Entity` 노드 레이블과 `entityType` 속성을 사용하는 범용 그래프 모델 도입. 기존의 도메인 종속적인 스키마를 걷어냄.

## 2. 인프라 및 운영 환경

- **Docker 기반**: Neo4j, PostgreSQL, Prometheus, Grafana, NeoDash가 Docker Compose로 묶여 동작. 다른 프로젝트와의 포트 충돌 방지를 위해 모든 기본 포트에 `+3` 오프셋을 적용 (예: Neo4j Bolt `7690`, Postgres `5435`).
- **모니터링**: FastAPI 자체 메트릭 및 Neo4j 빌트인 메트릭을 Prometheus로 수집하여 자동 프로비저닝된 Grafana 대시보드에서 시각화.
- **데이터베이스 관리**: Cypher 스크립트 기반 동작을 Python으로 순차 실행(`apply_neo4j_migrations.py`)하여 제약조건과 초기 데이터를 안전하게 적재(Idempotent).

## 3. 테스트 및 품질

- **테스트 커버리지**: `pytest` 기반 단위 테스트와 API E2E 테스트 총 35개 보유(성공).
- **DB Mocking**: `conftest.py` 등에서 DB 연결 자체를 `MagicMock/AsyncMock` 기반으로 가짜 환경 주입하여 빠르게 테스트 수행.
- **인증 무력화**: `X-API-Key` 방식 인증을 포함하고 있으나 환경변수 미설정 시 Dev 모드로 동작하여 편리하게 콜 가능.

## 4. 백로그 및 한계점 (`10_session_log.md` 기반)

- ProjectionWorker의 처리가 실패(`FAILED` 상태) 시 자동 재시도하지 않으며, 현재는 DB 수동 쿼리를 통해 `PENDING` 리셋이 필요함.
- `graph_repository.py` 계층 등 실제 Neo4j에 쿼리를 쏘는 부분의 통합 테스트(통신 테스트) 배터리는 없음 (Mock 기반 테스트의 한계).
