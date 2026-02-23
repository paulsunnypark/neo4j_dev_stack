import asyncio
import json
from app.core.postgres import PostgresManager
from app.repositories.graph_repository import GraphRepository

POLL_INTERVAL_SEC = 1.0
BATCH_SIZE = 50

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
                    BATCH_SIZE
                )

                if not rows:
                    return 0

                outbox_ids = [r["outbox_id"] for r in rows]
                await conn.execute(
                    "UPDATE outbox SET status='PROCESSING', updated_at=now() WHERE id = ANY($1::bigint[])",
                    outbox_ids
                )

        # 트랜잭션 밖에서 Neo4j 작업(외부 의존성)
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
            except Exception as e:
                fail_map[outbox_id] = str(e)

        # 결과 반영
        async with pool.acquire() as conn:
            async with conn.transaction():
                if ok_ids:
                    await conn.execute(
                        "UPDATE outbox SET status='DONE', updated_at=now() WHERE id = ANY($1::bigint[])",
                        ok_ids
                    )
                for oid, err in fail_map.items():
                    await conn.execute(
                        """
                        UPDATE outbox
                        SET status='FAILED', retry_count=retry_count+1, last_error=$2, updated_at=now()
                        WHERE id=$1
                        """,
                        oid, err
                    )

        return len(rows)

    async def _apply_event(self, event_type: str, payload):
        if event_type == "DeviceStatusChanged":
            device_id = payload["device_id"]
            status = payload["status"]
            name = payload.get("name", device_id)
            await self.graph_repo.upsert_device(device_id, name, status)
        else:
            # 미지원 이벤트는 무시
            return
