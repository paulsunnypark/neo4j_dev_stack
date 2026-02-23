import asyncio
import json
import logging

from app.core.postgres import PostgresManager
from app.models.events import (
    AttributeChangedPayload,
    EntityCreatedPayload,
    EntityDeletedPayload,
    RelationshipEstablishedPayload,
    RelationshipRemovedPayload,
    StatusChangedPayload,
)
from app.repositories.graph_repository import GraphRepository

POLL_INTERVAL_SEC = 1.0
BATCH_SIZE = 50
logger = logging.getLogger(__name__)


class ProjectionWorker:
    def __init__(self, graph_repo: GraphRepository):
        self.graph_repo = graph_repo
        self._stop = False

    def stop(self):
        self._stop = True

    async def run_forever(self):
        while not self._stop:
            processed = await self._process_batch()
            if processed == 0:
                await asyncio.sleep(POLL_INTERVAL_SEC)

    async def _process_batch(self) -> int:
        pool = PostgresManager.pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                rows = await conn.fetch(
                    """
                    SELECT o.id AS outbox_id, e.id AS event_id, e.event_type, e.payload
                    FROM outbox o
                    JOIN event_log e ON e.id = o.event_id
                    WHERE o.status='PENDING'
                    ORDER BY o.created_at
                    LIMIT $1
                    FOR UPDATE SKIP LOCKED
                    """,
                    BATCH_SIZE,
                )

                if not rows:
                    return 0

                outbox_ids = [r["outbox_id"] for r in rows]
                await conn.execute(
                    "UPDATE outbox SET status='PROCESSING', updated_at=now() WHERE id = ANY($1::bigint[])",
                    outbox_ids,
                )

        ok_ids = []
        fail_map: dict[int, str] = {}

        for r in rows:
            outbox_id = int(r["outbox_id"])
            event_type = r["event_type"]
            raw = r["payload"]
            payload = json.loads(raw) if isinstance(raw, str) else raw

            try:
                await self._apply_event(event_type, payload)
                ok_ids.append(outbox_id)
                try:
                    from app.core.metrics import OUTBOX_PROCESSED

                    OUTBOX_PROCESSED.labels(event_type=event_type).inc()
                except Exception:
                    pass
            except Exception as e:
                logger.exception("Failed to apply event %s (outbox_id=%s)", event_type, outbox_id)
                fail_map[outbox_id] = str(e)
                try:
                    from app.core.metrics import OUTBOX_FAILED

                    OUTBOX_FAILED.labels(event_type=event_type).inc()
                except Exception:
                    pass

        async with pool.acquire() as conn:
            async with conn.transaction():
                if ok_ids:
                    await conn.execute(
                        "UPDATE outbox SET status='DONE', updated_at=now() WHERE id = ANY($1::bigint[])",
                        ok_ids,
                    )
                for oid, err in fail_map.items():
                    await conn.execute(
                        """
                        UPDATE outbox
                        SET status='FAILED', retry_count=retry_count+1, last_error=$2, updated_at=now()
                        WHERE id=$1
                        """,
                        oid,
                        err,
                    )

        return len(rows)

    async def _apply_event(self, event_type: str, payload: dict):
        if event_type == "EntityCreated":
            p = EntityCreatedPayload(**payload)
            await self.graph_repo.upsert_entity(
                p.project_id, p.entity_id, p.entity_type, p.name, p.attributes
            )

        elif event_type == "EntityDeleted":
            p = EntityDeletedPayload(**payload)
            await self.graph_repo.delete_entity(p.project_id, p.entity_id)

        elif event_type == "AttributeChanged":
            p = AttributeChangedPayload(**payload)
            await self.graph_repo.set_attribute(p.project_id, p.entity_id, p.attribute_key, p.new_value)

        elif event_type == "RelationshipEstablished":
            p = RelationshipEstablishedPayload(**payload)
            await self.graph_repo.upsert_relationship(
                p.project_id, p.from_id, p.to_id, p.rel_type, p.properties
            )

        elif event_type == "RelationshipRemoved":
            p = RelationshipRemovedPayload(**payload)
            await self.graph_repo.remove_relationship(p.project_id, p.from_id, p.to_id, p.rel_type)

        elif event_type == "StatusChanged":
            p = StatusChangedPayload(**payload)
            await self.graph_repo.set_status(p.project_id, p.entity_id, p.new_status)

        elif event_type == "DeviceStatusChanged":
            project_id = payload["project_id"]
            device_id = payload["device_id"]
            status = payload["status"]
            name = payload.get("name", device_id)
            await self.graph_repo.upsert_device(project_id, device_id, name, status)

        else:
            logger.warning("Unsupported event type ignored: %s", event_type)
