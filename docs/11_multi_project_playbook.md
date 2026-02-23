# 11. Multi-Project Playbook (Complex Projects)

This guide explains how to use `neo4j_dev_stack` as a shared graph platform for multiple complex projects such as:
- `D:\devspace\project_a`
- `D:\devspace\project_b`

## Target Outcome

- One stack, multiple projects
- No data contamination between projects
- Reproducible delivery workflow

## A. Architecture Strategy

Use `neo4j_dev_stack` as an integration boundary:
- Each project emits graph events via HTTP API
- Stack persists event log/outbox in Postgres
- Projection worker applies data to Neo4j

Benefits:
- retry/recovery via outbox
- deterministic write path
- easier audit and rollback analysis

## B. Project Onboarding Procedure

1. Decide a permanent `project_id`.
- Example: `project-a`

2. Build an adapter in your project.
- Wrap calls to:
  - `POST /entities`
  - `POST /entities/{id}/status`
  - `POST /entities/{id}/attributes`
  - `POST /relationships`
  - `DELETE /relationships`

3. Enforce payload contract in the adapter.
- Every request includes `project_id`
- Fail fast before HTTP call if missing

4. Create seed graph for the project.
- Initial entity set via API or cypher migration with `projectId`

## C. Data Modeling Rules

1. Node identity is `(projectId, id)`.
2. Relationship endpoints must share the same `projectId`.
3. Keep `entityType` and `rel_type` as stable enums per project domain.
4. Use explicit naming conventions.
- IDs: `svc-auth-01`, `dev-edge-02`
- Relationship types: `DEPENDS_ON`, `CONNECTS_TO`, `PRODUCES`

## D. Delivery Workflow for Complex Features

1. Domain change design
- update event payload schema
- update graph transformation logic

2. Implementation
- project app emits events
- stack projects to graph

3. Verification
- API checks: `/health`, `/outbox/stats?project_id=...`
- graph checks in NeoDash

4. Performance and failure checks
- monitor outbox backlog/failures
- verify no cross-project reads

5. Release hardening
- run e2e by project_id
- confirm idempotency on replay

## E. Isolation Verification Checklist

For each release candidate:

1. `project-a` entity create/list works.
2. same `entity_id` in `project-b` can coexist.
3. `project-a` list never returns `project-b` nodes.
4. relationship delete cannot remove other project edges.
5. outbox stats are project-scoped.

## F. Recommended Adapter Interface

```text
GraphAdapter.create_entity(project_id, entity_id, entity_type, name, attributes)
GraphAdapter.set_status(project_id, entity_id, entity_type, new_status)
GraphAdapter.set_attribute(project_id, entity_id, entity_type, key, value)
GraphAdapter.link(project_id, from_id, from_type, to_id, to_type, rel_type, props)
GraphAdapter.unlink(project_id, from_id, from_type, to_id, to_type, rel_type)
```

## G. Operational Guardrails

- Do not bypass API and write directly to Neo4j from project apps.
- Keep one source of truth for `project_id` inside each project.
- Add contract tests that reject missing `project_id`.
- Maintain separate test fixtures per project.

## H. Dashboard Guidance

NeoDash URL: `http://localhost:5008`

For each report query, include project filter:

```cypher
MATCH (e:Entity)
WHERE e.projectId = 'project-a'
RETURN e
LIMIT 100
```

This prevents visual data mixing in shared dashboards.
