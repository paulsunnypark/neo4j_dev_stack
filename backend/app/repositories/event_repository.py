import json
from typing import Any, Dict, Iterable
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

    async def append_events(self, events: Iterable[Dict[str, Any]]) -> list[int]:
        pool = PostgresManager.pool()
        event_ids: list[int] = []
        async with pool.acquire() as conn:
            async with conn.transaction():
                for event in events:
                    row = await conn.fetchrow(
                        "INSERT INTO event_log(event_type, actor, payload) VALUES($1,$2,$3) RETURNING id",
                        event["event_type"],
                        event.get("actor"),
                        json.dumps(event["payload"]),
                    )
                    event_id = int(row["id"])
                    await conn.execute(
                        "INSERT INTO outbox(event_id, status) VALUES($1,'PENDING')",
                        event_id,
                    )
                    event_ids.append(event_id)
        return event_ids
