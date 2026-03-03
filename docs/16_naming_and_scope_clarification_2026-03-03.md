# 16. Naming and Scope Clarification (2026-03-03)

## 결론

- 이번 Aura/경량화 작업은 **`neo4j_dev_stack` 저장소의 작업**이다.
- 실행 런타임/컴포즈 명칭은 **`neo_stacker`** 이며, 이는 앱/배포 단위 이름이다.
- 따라서 현재 상태는 "새 프로젝트 생성"이 아니라, **기존 `neo4j_dev_stack`을 `neo_stacker` 런타임으로 경량 운영 전환**한 것이다.

## 이름 매핑

- 저장소 이름: `neo4j_dev_stack`
- docker compose name: `neo_stacker`
- 주요 컨테이너:
  - `neo_stacker_api`
  - `neo_stacker_ui`
  - `neo4j_dev_postgres`

## 이번 전환의 핵심

- 기본 Docker 실행 대상을 3개 서비스로 축소:
  - `postgres`, `backend`, `frontend`
- Aura 연결을 기본 운영값으로 지정:
  - `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`, `NEO4J_DATABASE`
- 로컬 Neo4j는 Docker에 포함하지 않고, 필요 시 별도 설치형 Neo4j에 env-file로 연결

## 사용자 영향

- 기존 NeoDash 중심 흐름이 아니라 `neo_stacker` UI 중심으로 운영한다.
- Outbox/Entity/Stats 등 API는 동일 저장소의 backend를 사용하며 Aura 대상으로 동작한다.

## 검증 포인트

- `/health` 응답에서 `neo4j=true`, `postgres=true`
- `/projects`, `/entities`, `/outbox`, `/outbox/stats` 정상 응답
- Outbox 503(`column o.processed_at does not exist`) 이슈 수정 반영
