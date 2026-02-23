# 04. FastAPI API Reference

Base URL: `http://localhost:8000`
Docs UI: `http://localhost:8000/docs`
Auth: `X-API-Key: <api_key>`

## Core Rule

`project_id` is mandatory for all project data operations.
- Body field: create/update relationship operations
- Query field: list/delete/stat operations
- Missing `project_id` returns `422`

## Auth

- If `API_KEY` is empty: dev mode, auth header optional
- If `API_KEY` is set: `X-API-Key` required

## Ops Endpoints

### `GET /health`
- Auth: not required
- Description: Neo4j/Postgres connectivity

### `GET /metrics`
- Auth: not required
- Description: Prometheus metrics

### `GET /outbox/stats?project_id=...`
- Auth: required
- Description: Outbox counts for one project only

Example:

```http
GET /outbox/stats?project_id=project-a
```

## Entity Endpoints

### `POST /entities`
- Auth: required
- Response: `202`

Body:

```json
{
  "project_id": "project-a",
  "entity_id": "dev-001",
  "entity_type": "Device",
  "name": "Living Room Sensor",
  "attributes": {
    "location": "room-1",
    "version": "2.0"
  }
}
```

### `GET /entities?project_id=...&entity_type=...&page=1&size=20`
- Auth: required
- Response: paged entity list in one project scope

### `DELETE /entities/{entity_id}?project_id=...&entity_type=...`
- Auth: required
- Response: `202`

### `POST /entities/{entity_id}/status`
- Auth: required
- Response: `202`

Body:

```json
{
  "project_id": "project-a",
  "entity_id": "dev-001",
  "entity_type": "Device",
  "new_status": "OFFLINE"
}
```

### `POST /entities/{entity_id}/attributes`
- Auth: required
- Response: `202`

Body:

```json
{
  "project_id": "project-a",
  "entity_id": "dev-001",
  "entity_type": "Device",
  "attribute_key": "firmware_version",
  "new_value": "2.0"
}
```

## Relationship Endpoints

### `POST /relationships`
- Auth: required
- Response: `202`

Body:

```json
{
  "project_id": "project-a",
  "from_id": "dev-001",
  "from_type": "Device",
  "to_id": "svc-001",
  "to_type": "Service",
  "rel_type": "DEPENDS_ON",
  "properties": {
    "priority": "high"
  }
}
```

### `DELETE /relationships`
- Auth: required
- Response: `202`

Body:

```json
{
  "project_id": "project-a",
  "from_id": "dev-001",
  "from_type": "Device",
  "to_id": "svc-001",
  "to_type": "Service",
  "rel_type": "DEPENDS_ON"
}
```

## Legacy Endpoints

### `POST /devices/{device_id}/status?project_id=...`
- Auth: not required (legacy behavior)
- Note: still writes project-scoped events

### `GET /devices?project_id=...`
- Auth: not required (legacy behavior)
- Note: returns only devices in that project

## PowerShell Example

```powershell
$base = "http://localhost:8000"
$headers = @{'X-API-Key'='dev-secret-key-change-me'; 'Content-Type'='application/json'}

Invoke-RestMethod "$base/entities" -Method POST -Headers $headers `
  -Body '{"project_id":"project-a","entity_id":"svc-1","entity_type":"Service","name":"My Service"}'

Invoke-RestMethod "$base/entities?project_id=project-a&page=1&size=20" -Headers $headers

Invoke-RestMethod "$base/relationships" -Method POST -Headers $headers `
  -Body '{"project_id":"project-a","from_id":"dev-1","from_type":"Device","to_id":"svc-1","to_type":"Service","rel_type":"DEPENDS_ON"}'

Invoke-RestMethod "$base/outbox/stats?project_id=project-a" -Headers $headers
```
