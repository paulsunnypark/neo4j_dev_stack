import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse

from app.core.auth import verify_api_key
from app.core.config import settings
from app.core.metrics import OUTBOX_PENDING, metrics_app
from app.core.neo4j import Neo4jManager
from app.core.postgres import PostgresManager
from app.models.api import ErrorResponse, EventQueued, HealthResponse, PagedResponse
from app.models.events import (
    AttributeChangedPayload,
    EntityCreatedPayload,
    EntityDeletedPayload,
    RelationshipEstablishedPayload,
    RelationshipRemovedPayload,
    StatusChangedPayload,
)
from app.repositories.event_repository import EventRepository
from app.repositories.graph_repository import GraphRepository
from app.services.projection_worker import ProjectionWorker

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

_worker: Optional[ProjectionWorker] = None
_worker_task: Optional[asyncio.Task] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _worker, _worker_task
    logger.info("Starting up %s %s ...", settings.app_title, settings.app_version)
    Neo4jManager.get_driver()
    await PostgresManager.init()
    _worker = ProjectionWorker(GraphRepository(Neo4jManager.get_driver()))
    _worker_task = asyncio.create_task(_worker.run_forever())
    yield
    logger.info("Shutting down ...")
    if _worker:
        _worker.stop()
    if _worker_task:
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
    await PostgresManager.close()
    await Neo4jManager.close()


app = FastAPI(
    title=settings.app_title,
    version=settings.app_version,
    lifespan=lifespan,
    description=(
        "범용 Neo4j+Postgres 이벤트 소싱 + 그래프 투영 개발 스택. "
        "Outbox 패턴으로 Postgres→Neo4j 동기화."
    ),
)

# Prometheus 메트릭 엔드포인트
app.mount("/metrics", metrics_app)


# ── 글로벌 에러 핸들러 ──────────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(error="Internal Server Error", detail=str(exc)).model_dump(),
    )


# ── Health ──────────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["ops"])
async def health():
    """Neo4j, Postgres 연결 상태를 포함한 헬스 체크."""
    neo4j_ok = False
    pg_ok = False

    try:
        driver = Neo4jManager.get_driver()
        await driver.verify_connectivity()
        neo4j_ok = True
    except Exception:
        pass

    try:
        pool = PostgresManager.pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        pg_ok = True
    except Exception:
        pass

    # PENDING 카운트를 Prometheus Gauge에 반영
    try:
        pool = PostgresManager.pool()
        async with pool.acquire() as conn:
            pending = await conn.fetchval("SELECT count(*) FROM outbox WHERE status='PENDING'")
        OUTBOX_PENDING.set(pending or 0)
    except Exception:
        pass

    return HealthResponse(
        ok=neo4j_ok and pg_ok,
        neo4j=neo4j_ok,
        postgres=pg_ok,
        version=settings.app_version,
    )


# ── Entity API ──────────────────────────────────────────────────────────────────

@app.post(
    "/entities",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=EventQueued,
    tags=["entities"],
)
async def create_entity(
    payload: EntityCreatedPayload,
    _: str = Depends(verify_api_key),
):
    """새 Entity 생성 이벤트를 발행. Outbox 패턴으로 Neo4j에 비동기 투영."""
    event_id = await EventRepository().append_event(
        event_type="EntityCreated",
        payload=payload.model_dump(),
        actor="api",
    )
    return EventQueued(event_id=event_id)


@app.get(
    "/entities",
    response_model=PagedResponse,
    tags=["entities"],
)
async def list_entities(
    entity_type: Optional[str] = Query(None, description="필터링할 엔티티 타입 (예: Device, Service)"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    size: int = Query(20, ge=1, le=100, description="페이지 크기"),
    _: str = Depends(verify_api_key),
):
    """Neo4j에서 Entity 목록을 페이지네이션으로 조회."""
    repo = GraphRepository(Neo4jManager.get_driver())
    items = await repo.list_entities(entity_type=entity_type, page=page, size=size)
    total = await repo.count_entities(entity_type=entity_type)
    pages = (total + size - 1) // size if total > 0 else 1
    return PagedResponse(items=items, total=total, page=page, size=size, pages=pages)


@app.delete(
    "/entities/{entity_id}",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=EventQueued,
    tags=["entities"],
)
async def delete_entity(
    entity_id: str,
    entity_type: str = Query(..., description="삭제할 엔티티 타입"),
    _: str = Depends(verify_api_key),
):
    """Entity 삭제 이벤트 발행."""
    event_id = await EventRepository().append_event(
        event_type="EntityDeleted",
        payload={"entity_id": entity_id, "entity_type": entity_type},
        actor="api",
    )
    return EventQueued(event_id=event_id)


@app.post(
    "/entities/{entity_id}/status",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=EventQueued,
    tags=["entities"],
)
async def change_status(
    entity_id: str,
    payload: StatusChangedPayload,
    _: str = Depends(verify_api_key),
):
    """Entity 상태 변경 이벤트 발행."""
    data = payload.model_dump()
    data["entity_id"] = entity_id
    event_id = await EventRepository().append_event(
        event_type="StatusChanged",
        payload=data,
        actor="api",
    )
    return EventQueued(event_id=event_id)


@app.post(
    "/entities/{entity_id}/attributes",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=EventQueued,
    tags=["entities"],
)
async def change_attribute(
    entity_id: str,
    payload: AttributeChangedPayload,
    _: str = Depends(verify_api_key),
):
    """Entity 속성 변경 이벤트 발행."""
    data = payload.model_dump()
    data["entity_id"] = entity_id
    event_id = await EventRepository().append_event(
        event_type="AttributeChanged",
        payload=data,
        actor="api",
    )
    return EventQueued(event_id=event_id)


# ── Relationship API ────────────────────────────────────────────────────────────

@app.post(
    "/relationships",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=EventQueued,
    tags=["relationships"],
)
async def create_relationship(
    payload: RelationshipEstablishedPayload,
    _: str = Depends(verify_api_key),
):
    """두 Entity 간 관계 생성 이벤트 발행."""
    event_id = await EventRepository().append_event(
        event_type="RelationshipEstablished",
        payload=payload.model_dump(),
        actor="api",
    )
    return EventQueued(event_id=event_id)


@app.delete(
    "/relationships",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=EventQueued,
    tags=["relationships"],
)
async def remove_relationship(
    payload: RelationshipRemovedPayload,
    _: str = Depends(verify_api_key),
):
    """두 Entity 간 관계 삭제 이벤트 발행."""
    event_id = await EventRepository().append_event(
        event_type="RelationshipRemoved",
        payload=payload.model_dump(),
        actor="api",
    )
    return EventQueued(event_id=event_id)


# ── Outbox 상태 조회 ────────────────────────────────────────────────────────────

@app.get("/outbox/stats", tags=["ops"])
async def outbox_stats(_: str = Depends(verify_api_key)):
    """Outbox 상태별 카운트 조회 (Postgres 직접 조회)."""
    try:
        pool = PostgresManager.pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT status, count(*) AS cnt FROM outbox GROUP BY status ORDER BY status"
            )
        return {r["status"]: r["cnt"] for r in rows}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


# ── 하위 호환 Legacy Device API ────────────────────────────────────────────────

@app.post("/devices/{device_id}/status", status_code=status.HTTP_202_ACCEPTED, tags=["legacy"])
async def set_device_status(device_id: str, req: dict):
    """[Legacy] Device 상태 변경. /entities/{id}/status 사용 권장."""
    event_id = await EventRepository().append_event(
        event_type="DeviceStatusChanged",
        payload={"device_id": device_id, "status": req.get("status", "UNKNOWN"), "name": device_id},
        actor="api",
    )
    return {"device_id": device_id, "event_id": event_id, "note": "Queued for projection"}


@app.get("/devices", tags=["legacy"])
async def list_devices():
    """[Legacy] Device 목록 조회. GET /entities?entity_type=Device 사용 권장."""
    repo = GraphRepository(Neo4jManager.get_driver())
    rows = await repo.run_read(
        "MATCH (e:Entity {entityType:'Device'}) "
        "RETURN e.id AS id, e.name AS name, e.status AS status ORDER BY e.id"
    )
    return rows
