from typing import Any, Dict, List, Optional
from neo4j import AsyncDriver
from app.core.config import settings


def _sanitize(value: Any) -> Any:
    """Neo4j 전용 타입(DateTime, Date, Time 등)을 JSON 직렬화 가능한 타입으로 변환."""
    try:
        # neo4j.time.DateTime / Date / Time / Duration 모두 __str__ 지원
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

    # ── 범용 읽기/쓰기 ─────────────────────────────────────────────────────────

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

    # ── Entity CRUD ────────────────────────────────────────────────────────────

    async def upsert_entity(
        self,
        entity_id: str,
        entity_type: str,
        name: Optional[str] = None,
        attributes: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Entity 단일 레이블 + entityType 속성 방식.
        (:Entity {id, entityType, name, status, ...attributes})
        APOC 없이 동작.
        """
        attrs: Dict[str, Any] = dict(attributes or {})
        if name is not None:
            attrs["name"] = name

        # 동적 속성 SET: 안전한 파라미터 바인딩을 위해 키별로 파라미터화
        set_clauses = ", ".join(f"e.`{k}` = $attr_{i}" for i, k in enumerate(attrs))
        params: Dict[str, Any] = {"entity_id": entity_id, "entity_type": entity_type}
        for i, (k, v) in enumerate(attrs.items()):
            params[f"attr_{i}"] = v

        cypher = f"""
        MERGE (e:Entity {{id: $entity_id}})
        SET e.entityType = $entity_type,
            e.updatedAt  = datetime()
        {f"SET {set_clauses}" if set_clauses else ""}
        """
        await self.run_write(cypher, params)

    async def delete_entity(self, entity_id: str) -> None:
        """노드와 연결된 모든 관계를 포함하여 삭제."""
        await self.run_write(
            "MATCH (e:Entity {id: $entity_id}) DETACH DELETE e",
            {"entity_id": entity_id},
        )

    async def set_attribute(self, entity_id: str, key: str, value: Any) -> None:
        # Neo4j 5.x: SET e[$key] = $value 동적 속성 지원
        cypher = """
        MATCH (e:Entity {id: $entity_id})
        SET e[$key] = $value, e.updatedAt = datetime()
        """
        await self.run_write(cypher, {"entity_id": entity_id, "key": key, "value": value})

    async def set_status(self, entity_id: str, new_status: str) -> None:
        await self.run_write(
            "MATCH (e:Entity {id: $entity_id}) SET e.status = $status, e.updatedAt = datetime()",
            {"entity_id": entity_id, "status": new_status},
        )

    # ── 관계 관리 ──────────────────────────────────────────────────────────────

    async def upsert_relationship(
        self,
        from_id: str,
        to_id: str,
        rel_type: str,
        properties: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        동적 관계 타입 MERGE.
        APOC apoc.merge.relationship → 실패 시 정적 MERGE fallback.
        """
        props = properties or {}
        try:
            cypher = """
            MATCH (a:Entity {id: $from_id})
            MATCH (b:Entity {id: $to_id})
            CALL apoc.merge.relationship(a, $rel_type, {}, $props, b, {})
            YIELD rel
            SET rel.updatedAt = datetime()
            """
            await self.run_write(cypher, {
                "from_id": from_id, "to_id": to_id,
                "rel_type": rel_type, "props": props,
            })
        except Exception:
            # APOC 미지원 시: rel_type을 backtick으로 감싸 정적 MERGE
            fallback = f"""
            MATCH (a:Entity {{id: $from_id}})
            MATCH (b:Entity {{id: $to_id}})
            MERGE (a)-[r:`{rel_type}`]->(b)
            SET r += $props, r.updatedAt = datetime()
            """
            await self.run_write(fallback, {"from_id": from_id, "to_id": to_id, "props": props})

    async def remove_relationship(self, from_id: str, to_id: str, rel_type: str) -> None:
        cypher = f"""
        MATCH (a:Entity {{id: $from_id}})-[r:`{rel_type}`]->(b:Entity {{id: $to_id}})
        DELETE r
        """
        await self.run_write(cypher, {"from_id": from_id, "to_id": to_id})

    # ── 조회 (페이지네이션) ────────────────────────────────────────────────────

    async def list_entities(
        self,
        entity_type: Optional[str] = None,
        page: int = 1,
        size: int = 20,
    ) -> List[Dict[str, Any]]:
        skip = (page - 1) * size
        if entity_type:
            cypher = """
            MATCH (e:Entity {entityType: $entity_type})
            RETURN e{.*} AS entity ORDER BY e.id SKIP $skip LIMIT $size
            """
            params: Dict[str, Any] = {"entity_type": entity_type, "skip": skip, "size": size}
        else:
            cypher = """
            MATCH (e:Entity)
            RETURN e{.*} AS entity ORDER BY e.id SKIP $skip LIMIT $size
            """
            params = {"skip": skip, "size": size}
        rows = await self.run_read(cypher, params)
        return [r["entity"] for r in rows]

    async def count_entities(self, entity_type: Optional[str] = None) -> int:
        if entity_type:
            rows = await self.run_read(
                "MATCH (e:Entity {entityType: $entity_type}) RETURN count(e) AS total",
                {"entity_type": entity_type},
            )
        else:
            rows = await self.run_read("MATCH (e:Entity) RETURN count(e) AS total")
        return int(rows[0]["total"]) if rows else 0

    # ── 하위 호환 (기존 Device API) ────────────────────────────────────────────

    async def upsert_device(self, device_id: str, name: str, status: str) -> None:
        await self.upsert_entity(
            entity_id=device_id,
            entity_type="Device",
            name=name,
            attributes={"status": status},
        )
