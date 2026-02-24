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
docker compose up -d
docker compose ps
```

`neo4j`, `postgres`가 `healthy`인지 확인합니다.

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

- NeoDash(권장): http://localhost:5008
  - Username: `neo4j`
  - Password: `neo4j_password_change_me`
- FastAPI Docs: http://localhost:8000/docs
  - Header: `X-API-Key: dev-secret-key-change-me`
- FastAPI Health: http://localhost:8000/health
- Neo4j Browser(옵션): http://localhost:7477
- Grafana: http://localhost:3003 (`admin` / `admin_change_me`)
- Prometheus: http://localhost:9093

중요:

- 브라우저 사용자는 NeoDash(`http://localhost:5008`)로 접속합니다.
- Bolt URL을 브라우저에 직접 입력해 연결하는 절차는 문서 기준에서 사용하지 않습니다.

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

## 12) 외부 프로젝트 연동 라이브러리 가이드 (Integration Guide)

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
- DB 연결 실패: `docker compose ps`에서 `neo4j`, `postgres` 상태 확인
- API 401/403: `X-API-Key` 헤더 값 확인
- NeoDash 경고 관련: 평문 비밀번호는 설정에 저장하지 않음(현재 구성 반영 완료)
- NeoDash 편집 UI(Add Report, Save 등)가 보이지 않거나 오류가 날 때:
  - 브라우저 로컬 스토리지에 이전 뷰어 전용 상태(`standalone=true`)가 캐시되어 발생할 수 있습니다.
  - 브라우저 창을 시크릿 모드로 접속하거나, 캐시 및 쿠키를 비우면 정상적으로 "Save" 버튼과 사이드바 편집 모드가 노출됩니다.
