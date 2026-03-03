# 15. Aura/경량화 프로필 분리 운영 검증 (2026-03-03)

## 목표

- 기존 스택과 Aura/경량화 버전을 **프로필 기반으로 분리 관리**
- 기본 Docker 운영에서 로컬 Neo4j 컨테이너 제외
- Aura 연결 실사용 API 경로 검증

## 분리 운영 방식

- 기본 compose: `docker/docker-compose.yml`
  - 포함 서비스: `postgres`, `backend`, `frontend`
  - Neo4j 연결값은 env-file에서 주입
- 프로필 파일:
  - `docker/.env.aura.example` -> `docker/.env.aura`
  - `docker/.env.local-install.example` -> `docker/.env.local`

## 검증 명령

```powershell
cd E:\neo4j_dev_stack\docker
docker compose --env-file .env.aura up -d --force-recreate postgres backend frontend

curl http://localhost:8000/health
curl -H "X-API-Key: dev-secret-key-change-me" http://localhost:8000/projects
```

## 검증 결과

- `GET /health`:
  - 결과: `{"ok":true,"neo4j":true,"postgres":true,"version":"1.0.0"}`
- `GET /projects` (API Key 포함):
  - 결과: `200 OK`, 빈 배열 `[]` 반환
- 쓰기/조회 경로 확인:
  - `POST /entities` -> `202 Accepted`
  - projection 대기 후 `GET /entities?project_id=aura-test...` -> `200 OK` + 생성 엔티티 조회 성공

## 장애 원인 및 조치

- 증상: `DatabaseNotFound` / `Unauthorized` 혼재
- 원인:
  - Aura username은 `neo4j`가 아니라 인스턴스 ID(`7445e7b0`)일 수 있음
  - Aura database도 `neo4j`가 아니라 인스턴스 ID(`7445e7b0`)일 수 있음
- 조치:
  - `.env.aura`의 `NEO4J_USER`, `NEO4J_DATABASE`를 Aura 콘솔 값으로 정확히 지정

## 결론

- Aura/경량화 운영 경로 검증 완료
- 로컬 설치형 Neo4j는 Docker 스택에서 제외된 상태로, `.env.local` 프로필을 통해 필요 시 별도 연동 가능
