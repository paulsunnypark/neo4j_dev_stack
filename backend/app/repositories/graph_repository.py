from typing import Any, Dict, List, Optional

from neo4j import AsyncDriver

from app.core.config import settings


def _sanitize(value: Any) -> Any:
    """Convert Neo4j temporal values to JSON-safe strings."""
    try:
        from neo4j.time import DateTime, Date, Time, Duration

        if isinstance(value, (DateTime, Date, Time, Duration)):
            return str(value)
    except ImportError:
        pass

    if isinstance(value, dict):
        return {k: _sanitize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize(v) for v in value]
    return value


class GraphRepository:
    def __init__(self, driver: AsyncDriver):
        self.driver = driver

    async def run_read(self, cypher: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        async with self.driver.session(database=settings.neo4j_database) as session:
            return await session.execute_read(self._read_tx, cypher, params or {})

    @staticmethod
    async def _read_tx(tx, cypher: str, params: Dict[str, Any]):
        res = await tx.run(cypher, params)
        return [_sanitize(r.data()) async for r in res]

    async def run_write(self, cypher: str, params: Optional[Dict[str, Any]] = None) -> None:
        async with self.driver.session(database=settings.neo4j_database) as session:
            await session.execute_write(lambda tx: tx.run(cypher, params or {}))

    async def upsert_entity(
        self,
        project_id: str,
        entity_id: str,
        entity_type: str,
        name: Optional[str] = None,
        attributes: Optional[Dict[str, Any]] = None,
    ) -> None:
        attrs: Dict[str, Any] = dict(attributes or {})
        if name is not None:
            attrs["name"] = name

        set_clauses = ", ".join(f"e.`{k}` = $attr_{i}" for i, k in enumerate(attrs))
        params: Dict[str, Any] = {
            "project_id": project_id,
            "entity_id": entity_id,
            "entity_type": entity_type,
        }
        for i, (k, v) in enumerate(attrs.items()):
            params[f"attr_{i}"] = v

        cypher = f"""
        MERGE (e:Entity {{projectId: $project_id, id: $entity_id}})
        SET e.projectId = $project_id,
            e.entityType = $entity_type,
            e.updatedAt  = datetime()
        {f"SET {set_clauses}" if set_clauses else ""}
        """
        await self.run_write(cypher, params)

    async def delete_entity(self, project_id: str, entity_id: str) -> None:
        await self.run_write(
            "MATCH (e:Entity {projectId: $project_id, id: $entity_id}) DETACH DELETE e",
            {"project_id": project_id, "entity_id": entity_id},
        )

    async def set_attribute(self, project_id: str, entity_id: str, key: str, value: Any) -> None:
        cypher = """
        MATCH (e:Entity {projectId: $project_id, id: $entity_id})
        SET e[$key] = $value, e.updatedAt = datetime()
        """
        await self.run_write(
            cypher,
            {"project_id": project_id, "entity_id": entity_id, "key": key, "value": value},
        )

    async def set_status(self, project_id: str, entity_id: str, new_status: str) -> None:
        await self.run_write(
            (
                "MATCH (e:Entity {projectId: $project_id, id: $entity_id}) "
                "SET e.status = $status, e.updatedAt = datetime()"
            ),
            {"project_id": project_id, "entity_id": entity_id, "status": new_status},
        )

    async def upsert_relationship(
        self,
        project_id: str,
        from_id: str,
        to_id: str,
        rel_type: str,
        properties: Optional[Dict[str, Any]] = None,
    ) -> None:
        props = properties or {}

        try:
            cypher = """
            MATCH (a:Entity {projectId: $project_id, id: $from_id})
            MATCH (b:Entity {projectId: $project_id, id: $to_id})
            CALL apoc.merge.relationship(a, $rel_type, {}, $props, b, {})
            YIELD rel
            SET rel.projectId = $project_id,
                rel.updatedAt = datetime()
            """
            await self.run_write(
                cypher,
                {
                    "project_id": project_id,
                    "from_id": from_id,
                    "to_id": to_id,
                    "rel_type": rel_type,
                    "props": props,
                },
            )
        except Exception:
            fallback = f"""
            MATCH (a:Entity {{projectId: $project_id, id: $from_id}})
            MATCH (b:Entity {{projectId: $project_id, id: $to_id}})
            MERGE (a)-[r:`{rel_type}`]->(b)
            SET r.projectId = $project_id,
                r += $props,
                r.updatedAt = datetime()
            """
            await self.run_write(
                fallback,
                {"project_id": project_id, "from_id": from_id, "to_id": to_id, "props": props},
            )

    async def remove_relationship(self, project_id: str, from_id: str, to_id: str, rel_type: str) -> None:
        cypher = f"""
        MATCH (a:Entity {{projectId: $project_id, id: $from_id}})
              -[r:`{rel_type}`]->
              (b:Entity {{projectId: $project_id, id: $to_id}})
        WHERE r.projectId = $project_id
        DELETE r
        """
        await self.run_write(cypher, {"project_id": project_id, "from_id": from_id, "to_id": to_id})

    async def list_entities(
        self,
        project_id: str,
        entity_type: Optional[str] = None,
        page: int = 1,
        size: int = 20,
    ) -> List[Dict[str, Any]]:
        skip = (page - 1) * size
        if entity_type:
            cypher = """
            MATCH (e:Entity {projectId: $project_id, entityType: $entity_type})
            RETURN e{.*} AS entity ORDER BY e.id SKIP $skip LIMIT $size
            """
            params: Dict[str, Any] = {
                "project_id": project_id,
                "entity_type": entity_type,
                "skip": skip,
                "size": size,
            }
        else:
            cypher = """
            MATCH (e:Entity {projectId: $project_id})
            RETURN e{.*} AS entity ORDER BY e.id SKIP $skip LIMIT $size
            """
            params = {"project_id": project_id, "skip": skip, "size": size}

        rows = await self.run_read(cypher, params)
        return [r["entity"] for r in rows]

    async def count_entities(self, project_id: str, entity_type: Optional[str] = None) -> int:
        if entity_type:
            rows = await self.run_read(
                (
                    "MATCH (e:Entity {projectId: $project_id, entityType: $entity_type}) "
                    "RETURN count(e) AS total"
                ),
                {"project_id": project_id, "entity_type": entity_type},
            )
        else:
            rows = await self.run_read(
                "MATCH (e:Entity {projectId: $project_id}) RETURN count(e) AS total",
                {"project_id": project_id},
            )
        return int(rows[0]["total"]) if rows else 0

    async def list_relationships(
        self,
        project_id: str,
        page: int = 1,
        size: int = 50,
    ) -> List[Dict[str, Any]]:
        skip = (page - 1) * size
        cypher = """
        MATCH (a:Entity {projectId: $project_id})-[r]->(b:Entity {projectId: $project_id})
        WHERE r.projectId = $project_id
        RETURN a.id AS source_id, b.id AS target_id, type(r) AS rel_type,
               properties(r) AS props
        ORDER BY a.id, b.id
        SKIP $skip LIMIT $size
        """
        return await self.run_read(
            cypher,
            {"project_id": project_id, "skip": skip, "size": size},
        )

    async def count_relationships(self, project_id: str) -> int:
        rows = await self.run_read(
            """
            MATCH (a:Entity {projectId: $project_id})-[r]->(b:Entity {projectId: $project_id})
            WHERE r.projectId = $project_id
            RETURN count(r) AS total
            """,
            {"project_id": project_id},
        )
        return int(rows[0]["total"]) if rows else 0

    async def upsert_device(self, project_id: str, device_id: str, name: str, status: str) -> None:
        await self.upsert_entity(
            project_id=project_id,
            entity_id=device_id,
            entity_type="Device",
            name=name,
            attributes={"status": status},
        )
