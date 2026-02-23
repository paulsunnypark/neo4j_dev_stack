from typing import Any

from neo4j import AsyncDriver

from app.core.config import settings


class GraphRepository:
    def __init__(self, driver: AsyncDriver):
        self.driver = driver

    async def run_read(self, cypher: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        async with self.driver.session(database=settings.neo4j_database) as session:
            return await session.execute_read(self._read_tx, cypher, params or {})

    @staticmethod
    async def _read_tx(tx, cypher: str, params: dict[str, Any]):
        res = await tx.run(cypher, params)
        return [r.data() async for r in res]

    async def upsert_device(self, device_id: str, name: str, status: str):
        cypher = """
        MERGE (d:Device {id:$id})
        SET d.name=$name, d.status=$status, d.updatedAt=datetime()
        """
        async with self.driver.session(database=settings.neo4j_database) as session:
            await session.execute_write(
                lambda tx: tx.run(cypher, {"id": device_id, "name": name, "status": status})
            )
