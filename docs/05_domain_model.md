# 05. Domain Model (Neo4j)

## Multi-Project Isolation Model

All graph data is tenant-scoped by `project_id`.

### Entity Shape

```cypher
(:Entity {
  projectId: String,  -- required tenant key
  id:        String,  -- entity identifier within project
  entityType:String,
  name:      String?,
  status:    String?,
  updatedAt: DateTime,
  ...
})
```

Identity rule:
- `id` is NOT globally unique
- `(projectId, id)` is unique

### Relationship Shape

```cypher
(:Entity)-[:REL_TYPE {
  projectId: String,
  updatedAt: DateTime,
  ...
}]->(:Entity)
```

Relationship operations always match both endpoints by `(projectId, id)`.

## Constraints and Indexes

Current migration strategy:
- Drop old `entity_id` unique constraint
- Create composite unique on `(projectId, id)`
- Add project-scoped indexes

```cypher
CREATE CONSTRAINT entity_project_id IF NOT EXISTS
FOR (e:Entity)
REQUIRE (e.projectId, e.id) IS UNIQUE;

CREATE INDEX entity_project IF NOT EXISTS
FOR (e:Entity)
ON (e.projectId);

CREATE INDEX entity_project_type IF NOT EXISTS
FOR (e:Entity)
ON (e.projectId, e.entityType);

CREATE INDEX entity_project_status IF NOT EXISTS
FOR (e:Entity)
ON (e.projectId, e.status);
```

## Event Payload Contract

Every event payload must include `project_id`.

- `EntityCreated`
- `EntityDeleted`
- `AttributeChanged`
- `RelationshipEstablished`
- `RelationshipRemoved`
- `StatusChanged`
- `DeviceStatusChanged` (legacy path)

Example:

```json
{
  "project_id": "project-a",
  "entity_id": "dev-1",
  "entity_type": "Device"
}
```

## Repository Contract (Summary)

`GraphRepository` write/read methods all require `project_id`.

- `upsert_entity(project_id, ...)`
- `delete_entity(project_id, ...)`
- `set_attribute(project_id, ...)`
- `set_status(project_id, ...)`
- `upsert_relationship(project_id, ...)`
- `remove_relationship(project_id, ...)`
- `list_entities(project_id, ...)`
- `count_entities(project_id, ...)`

## Seed Data

Seed entities are now stored under `projectId = "default"`.

If you use `project-a`, create initial entities with API/migration for that project.
