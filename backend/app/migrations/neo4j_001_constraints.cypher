-- 범용 Entity 제약/인덱스
CREATE CONSTRAINT entity_id IF NOT EXISTS
FOR (e:Entity)
REQUIRE e.id IS UNIQUE;

CREATE INDEX entity_type IF NOT EXISTS
FOR (e:Entity)
ON (e.entityType);

CREATE INDEX entity_status IF NOT EXISTS
FOR (e:Entity)
ON (e.status);

-- 하위 호환: 기존 Device 제약 유지
CREATE CONSTRAINT device_id IF NOT EXISTS
FOR (d:Device)
REQUIRE d.id IS UNIQUE;

CREATE INDEX device_status IF NOT EXISTS
FOR (d:Device)
ON (d.status);
