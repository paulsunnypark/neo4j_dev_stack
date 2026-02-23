-- 범용 Entity seed
MERGE (e:Entity {id: "entity-1"})
SET e.projectId = coalesce(e.projectId, "default"),
    e.entityType = "Device",
    e.name = "Device 1",
    e.status = "ONLINE",
    e.updatedAt = datetime();

MERGE (e:Entity {id: "entity-2"})
SET e.projectId = coalesce(e.projectId, "default"),
    e.entityType = "Service",
    e.name = "Service 1",
    e.status = "RUNNING",
    e.updatedAt = datetime();
