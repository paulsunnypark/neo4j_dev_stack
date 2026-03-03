# Cross-Repo Local Validation Report (2026-03-03)

## Objective

Validate latest codebases from both repositories on local `E:\` drive, run required Docker containers, and execute practical user-level smoke tests.

- `neo4j_dev_stack`
- `hi-se-simulator`

## 1) Repository Sync

Latest repositories were cloned to local drive:

- `E:\neo4j_dev_stack_latest`
- `E:\hi-se-simulator`

Remote verification references:

- `https://github.com/paulsunnypark/neo4j_dev_stack.git`
- `https://github.com/paulsunnypark/hi-se-simulator.git`

## 2) Docker Runtime Validation

### 2.1 neo4j_dev_stack

Compose file used:

- `E:\neo4j_dev_stack_latest\docker\docker-compose.yml`

Services confirmed running/healthy:

- `neo4j_dev_neo4j` (healthy)
- `neo4j_dev_postgres` (healthy)
- `neo4j_dev_neodash`
- `neo4j_dev_prometheus`
- `neo4j_dev_grafana`

Endpoint checks passed:

- `http://localhost:7477`
- `http://localhost:5008`
- `http://localhost:9093/-/ready`
- `http://localhost:3003/api/health`

### 2.2 hi-se-simulator

Compose file used:

- `E:\hi-se-simulator\docker-compose.yml`

Services confirmed running/healthy:

- `hise-postgres` (healthy)
- `hise-backend`
- `hise-nodered`

Endpoint checks passed:

- `http://localhost:8000/health`
- `http://localhost:8000/health/db`
- `http://localhost:8000/health/nodered`

## 3) User-Level Smoke Testing

### hi-se-simulator

Executed:

- `npm run test:smoke:device-control` -> PASS
  - backend health/HA status/student-device toggle/WS observation confirmed
- `npm run test:e2e:smoke` -> PARTIAL
  - preflight frontend/backend checks PASS
  - browser launch step FAIL in current environment due Playwright Chromium GPU process crash (`error_code=63`)

Interpretation:

- backend + API + websocket functional smoke path is validated
- full browser automation scenario is blocked by local headless Chromium runtime limitation (environment issue, not immediate API failure)

## 4) Environment Notes

- During validation, container name conflicts from prior local state were resolved by removing stale created containers.
- For `hi-se-simulator`, local PostgreSQL bind mount permissions caused startup failure; local validation used named volume mapping for successful runtime verification.

## 5) Conclusion

Both latest repositories were synchronized locally and Docker-based runtime validation was completed.

- `neo4j_dev_stack`: infrastructure container suite validated
- `hi-se-simulator`: backend/nodered/postgres validated + device-control smoke passed
- Remaining blocker: Playwright browser launch stability in this host environment for final browser-flow smoke
