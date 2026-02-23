MERGE (d:Device {id:"dev-1"})
SET d.name="Device 1", d.status="ONLINE", d.updatedAt=datetime();
