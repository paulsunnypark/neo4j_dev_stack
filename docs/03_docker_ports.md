# 03. Docker 구성 및 포트

## 프로젝트명

```yaml
name: neo_stacker
```

## 운영 모델

- 기본 운영: **Aura + 경량 Docker(postgres/backend/frontend)**
- 로컬 Neo4j: Docker 미포함, 필요 시 별도 설치 프로세스로만 준비

## 포트 매핑

| 서비스 | 컨테이너 | 호스트 포트 | 컨테이너 포트 | 용도 |
| ------ | -------- | ----------- | ------------- | ---- |
| PostgreSQL | neo4j_dev_postgres | `5435` | `5432` | 이벤트 로그/아웃박스 저장 |
| Backend API | neo_stacker_api | `8000` | `8000` | REST API |
| Frontend | neo_stacker_ui | `5173` | `5173` | 사용자 대시보드 |

## 프로필별 환경변수 파일

`docker` 폴더에서 `--env-file`로 명시적으로 선택해 운영합니다.

- Aura 프로필: `docker/.env.aura.example` 복사 후 값 채움
- Local-install 프로필: `docker/.env.local-install.example` 복사 후 값 채움

핵심 필수 변수:

```dotenv
NEO4J_URI=
NEO4J_USER=
NEO4J_PASSWORD=
NEO4J_DATABASE=
```

## 실행 예시

```powershell
cd D:\neo4j_dev_stack\docker

# Aura 운영
Copy-Item .env.aura.example .env.aura
docker compose --env-file .env.aura up -d postgres backend frontend

# Local 설치형 Neo4j 연동(준비용)
# Copy-Item .env.local-install.example .env.local
# docker compose --env-file .env.local up -d postgres backend frontend
```

## 점검 명령

```powershell
cd D:\neo4j_dev_stack\docker
docker compose ps
docker compose logs --tail 100 backend postgres
```
