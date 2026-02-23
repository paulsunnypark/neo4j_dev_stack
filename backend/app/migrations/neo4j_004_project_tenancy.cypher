-- Migrate single-key entity identity to project-scoped identity.
DROP CONSTRAINT entity_id IF EXISTS;

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
