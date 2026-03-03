# Neo4j Dev Stack Backend

Neo4j + PostgreSQL 기반 FastAPI 백엔드 개발 환경 가이드입니다.
이 문서는 실제 현재 실행 설정에 맞춰 정리되어 있습니다.

## 1) 사전 요구사항

- Python 3.11
- Docker Desktop (Docker Compose 포함)
- Git

```powershell
python --version
docker --version
docker compose version
git --version
```

## 2) 저장소 이동

```powershell
cd D:\neo4j_dev_stack
```

## 3) 가상환경 생성 및 활성화

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

실행 정책 오류가 나면(최초 1회):

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## 4) 패키지 설치

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 5) 환경변수 확인 (`backend/.env`)

저장소 기본값 기준:

```env
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

## 6) Docker 인프라 실행

```powershell
cd ..\docker
Copy-Item .env.aura.example .env.aura
# .env.aura 값 수정 후
docker compose --env-file .env.aura up -d postgres backend frontend
docker compose ps
```

`backend`, `postgres`가 `healthy`인지 확인합니다.

## 7) Neo4j 마이그레이션

```powershell
cd ..\backend
python scripts\apply_neo4j_migrations.py
```

## 8) FastAPI 실행

```powershell
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 9) 접속 주소 및 로그인 정보

- Frontend: http://localhost:5173
- FastAPI Docs: http://localhost:8000/docs
  - Header: `X-API-Key: dev-secret-key-change-me`
- FastAPI Health: http://localhost:8000/health

중요:

- 기본 운영은 AuraDB 연결입니다.
- 로컬 설치형 Neo4j는 Docker 스택에 포함하지 않고 필요 시 별도 프로세스로만 사용합니다.
- Aura의 데이터베이스명은 `neo4j`가 아닐 수 있으므로, Aura 콘솔에 표시된 DB 이름(예: `7445e7b0`)을 그대로 사용해야 합니다.

## 10) 필수 규칙: `project_id`

모든 프로젝트 데이터 API 요청에 `project_id`를 포함해야 합니다.

- Body 필수: `POST /entities`, `POST/DELETE /relationships`, 상태/속성 변경 API
- Query 필수: `GET /entities`, `DELETE /entities/{id}`, `GET /outbox/stats`

예시:

```powershell
$headers = @{'X-API-Key'='dev-secret-key-change-me'; 'Content-Type'='application/json'}

Invoke-RestMethod -Uri http://localhost:8000/entities -Method POST -Headers $headers `
  -Body '{"project_id":"project-a","entity_id":"dev-1","entity_type":"Device","name":"Device 1"}'

Invoke-RestMethod -Uri "http://localhost:8000/entities?project_id=project-a&page=1&size=20" -Headers $headers
Invoke-RestMethod -Uri "http://localhost:8000/outbox/stats?project_id=project-a" -Headers $headers
```

## 11) 테스트 (선택)

```powershell
pytest tests/ -v
```

## 12) 모니터링 (Grafana & Prometheus)

현재 인프라에는 백엔드 프로세스의 상태 및 부하를 모니터링하기 위한 스택이 구성되어 있습니다.

- **접속 주소**: `http://localhost:3003` (Grafana)
- **초기 로그인**: `admin` / `admin_change_me`
- **주요 대시보드 (TMS Outbox Monitoring)**:
  - 백엔드 FastAPI가 발생시키는 시계열 지표(Prometheus `outbox_processed_total` 등)를 바탕으로, Outbox 패턴의 이벤트 대기열 큐(Pending Queue)와 실시간 초당 처리량(Throughput)을 시각화합니다.
  - 시뮬레이터(`main.py --simulate`) 등으로 외부 API 호출 부하를 주면, 곧바로 Grafana 그래프에 데이터가 그려집니다.

## 13) 통합 프론트엔드 대시보드 (Frontend Dashboard)

`neo4j_dev_stack`은 단순한 백엔드 API 제공을 넘어, 그래프 토폴로지 모니터링 및 엔티티 제어를 위한 강력한 내장 프론트엔드를 공식 지원합니다. NeoDash의 한계를 극복하기 위해 커스텀 개발된 전용 UI입니다.

**Frontend Tech Stack:**

- **Core:** React 18, TypeScript, Vite
- **Styling (Standard):** Tailwind CSS (프리미엄 다크/글래스모피즘 테마)
- **Visualization:** `react-force-graph` (D3-force 기반 2D/3D 네트워크 토폴로지 렌더링)
- **State & API:** Axios (with X-API-Key interceptor)

## 14) 외부 프로젝트 연동 라이브러리 가이드 (Integration Guide)

본 `neo4j_dev_stack` 백엔드 환경은 다른 로컬 프로젝트(예: `project-a`)에서 코어 모듈(예: DB 연결)로 직접 임포트하여 재사용할 수 있습니다.

### 연동 방법

1. 대상 프로젝트의 Python 환경에 `.pth` 파일을 생성하여 본 스택의 `backend` 절대 경로를 추가합니다.
   - 예시 (Windows PowerShell): `echo "E:\neo4j_dev_stack\backend" > .venv\Lib\site-packages\neo4j_dev.pth`
2. **주의**: 대상 프로젝트의 주요 소스코드 디렉토리 이름은 `app`과 겹치지 않게 고유한 이름(예: `tms_app`)으로 설정해야 모듈 이름 공간 충돌(Shadowing)을 피할 수 있습니다.
3. 대상 프로젝트 코드 내에서 `from app.core.neo4j import Neo4jManager` 와 같이 본 스택의 모듈을 호출하여 DB 커넥션 풀 등의 인프라를 그대로 활용할 수 있습니다.

## 13) 종료

```powershell
cd ..\docker
docker compose down
```

## Troubleshooting

- `ModuleNotFoundError`: 가상환경 활성화 후 `pip install -r requirements.txt` 재실행
- DB 연결 실패: `docker compose ps`에서 `backend`, `postgres` 상태 확인
- API 401/403: `X-API-Key` 헤더 값 확인
