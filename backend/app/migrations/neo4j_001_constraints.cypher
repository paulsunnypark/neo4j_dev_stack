CREATE CONSTRAINT device_id IF NOT EXISTS
FOR (d:Device)
REQUIRE d.id IS UNIQUE;

CREATE INDEX device_status IF NOT EXISTS
FOR (d:Device)
ON (d.status);
