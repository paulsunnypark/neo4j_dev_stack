# PRD: Migrate backend to pyproject.toml

## Scope
- **In**:
  - E:\neo4j_dev_stack\backend\pyproject.toml 생성.
  - 기존 E:\neo4j_dev_stack\backend\requirements.txt에 명시된 의존성들을 Poetry 기반의 pyproject.toml 포맷으로 변환.
  - 임의의 프로젝트 폴더(예: devspace\project_a)에서 백엔드 환경을 공유할 수 있도록 패키지 및 개발 의존성을 분리(dev groups).
- **Out**:
  - 기존 E:\neo4j_dev_spec 오생성 디렉토리 삭제 

## Acceptance Criteria
- E:\neo4j_dev_stack\backend\pyproject.toml 파일 생성 및 유효성 검증
- 잘못 만들어진 E:\neo4j_dev_spec 디렉토리 완전 삭제
- E:\devspace\project_a 에서 pip install -e E:\neo4j_dev_stack\backend 명령이 성공 가능하도록 구성

