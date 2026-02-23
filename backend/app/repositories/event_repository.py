import json
from typing import Any, Dict
from app.core.postgres import PostgresManager

class EventRepository:
    async def append_event(self, event_type: str, payload: Dict[str, Any], actor: str | None = None) -> int:
        pool = PostgresManager.pool()
        async with pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow(
                    "INSERT INTO event_log(event_type, actor, payload) VALUES($1,$2,$3) RETURNING id",
                    event_type, actor, json.dumps(payload),
                )
                event_id = int(row["id"])
                await conn.execute(
                    "INSERT INTO outbox(event_id, status) VALUES($1,'PENDING')",
                    event_id
                )
                return event_id
