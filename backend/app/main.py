import asyncio
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
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
        "Neo4j + Postgres event-sourcing backend. "
        "All graph writes are projected asynchronously via outbox."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/metrics", metrics_app)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(error="Internal Server Error", detail=str(exc)).model_dump(),
    )


@app.get("/health", response_model=HealthResponse, tags=["ops"])
async def health():
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
    project_id: str = Query(..., min_length=1, description="Tenant/project scope ID"),
    entity_type: Optional[str] = Query(None, description="Entity type filter (e.g. Device, Service)"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(20, ge=1, le=100, description="Page size"),
    _: str = Depends(verify_api_key),
):
    repo = GraphRepository(Neo4jManager.get_driver())
    items = await repo.list_entities(project_id=project_id, entity_type=entity_type, page=page, size=size)
    total = await repo.count_entities(project_id=project_id, entity_type=entity_type)
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
    project_id: str = Query(..., min_length=1, description="Tenant/project scope ID"),
    entity_type: str = Query(..., description="Entity type"),
    _: str = Depends(verify_api_key),
):
    event_id = await EventRepository().append_event(
        event_type="EntityDeleted",
        payload={"project_id": project_id, "entity_id": entity_id, "entity_type": entity_type},
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
    data = payload.model_dump()
    data["entity_id"] = entity_id
    event_id = await EventRepository().append_event(
        event_type="AttributeChanged",
        payload=data,
        actor="api",
    )
    return EventQueued(event_id=event_id)


@app.get(
    "/relationships",
    response_model=PagedResponse,
    tags=["relationships"],
)
async def list_relationships(
    project_id: str = Query(..., min_length=1, description="Tenant/project scope ID"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(50, ge=1, le=500, description="Page size"),
    _: str = Depends(verify_api_key),
):
    repo = GraphRepository(Neo4jManager.get_driver())
    items = await repo.list_relationships(project_id=project_id, page=page, size=size)
    total = await repo.count_relationships(project_id=project_id)
    pages = (total + size - 1) // size if total > 0 else 1
    return PagedResponse(items=items, total=total, page=page, size=size, pages=pages)


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
    event_id = await EventRepository().append_event(
        event_type="RelationshipRemoved",
        payload=payload.model_dump(),
        actor="api",
    )
    return EventQueued(event_id=event_id)


@app.get("/projects", tags=["projects"])
async def list_projects(
    _: str = Depends(verify_api_key),
):
    try:
        repo = GraphRepository(Neo4jManager.get_driver())
        async with repo.driver.session() as session:
            res = await session.run("MATCH (n:Entity) WHERE n.projectId IS NOT NULL RETURN DISTINCT n.projectId AS project_id")
            records = await res.data()
            projects = [r["project_id"] for r in records]
        return projects
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/stats", tags=["ops"])
async def graph_stats(
    project_id: str = Query(..., min_length=1, description="Tenant/project scope ID"),
    _: str = Depends(verify_api_key),
):
    try:
        repo = GraphRepository(Neo4jManager.get_driver())
        async with repo.driver.session() as session:
            # Total Nodes
            res_nodes = await session.run("MATCH (n:Entity {projectId: $project_id}) RETURN count(n) AS cnt", project_id=project_id)
            nodes_cnt = (await res_nodes.single())["cnt"]
            
            # Active Nodes
            res_active = await session.run("MATCH (n:Entity {projectId: $project_id, status: 'ON'}) RETURN count(n) AS cnt", project_id=project_id)
            active_cnt = (await res_active.single())["cnt"]
            
            # Total Relationships
            res_rels = await session.run("MATCH (a:Entity {projectId: $project_id})-[r]->(b:Entity {projectId: $project_id}) RETURN count(r) AS cnt", project_id=project_id)
            rels_cnt = (await res_rels.single())["cnt"]
            
        return {
            "total_nodes": nodes_cnt,
            "active_nodes": active_cnt,
            "total_relationships": rels_cnt
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

@app.get("/outbox/stats", tags=["ops"])
async def outbox_stats(
    project_id: str = Query(..., min_length=1, description="Tenant/project scope ID"),
    _: str = Depends(verify_api_key),
):
    try:
        pool = PostgresManager.pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT o.status, count(*) AS cnt
                FROM outbox o
                JOIN event_log e ON e.id = o.event_id
                WHERE (e.payload->>'project_id' = $1 OR e.payload->>'projectId' = $1)
                GROUP BY o.status
                ORDER BY o.status
                """,
                project_id,
            )
        return {r["status"]: r["cnt"] for r in rows}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/outbox", tags=["ops"])
async def list_outbox(
    project_id: str = Query(..., min_length=1, description="Tenant/project scope ID"),
    status: Optional[str] = Query(None, description="Filter by status (PENDING, PROCESSING, DONE, FAILED)"),
    limit: int = Query(50, ge=1, le=200),
    _: str = Depends(verify_api_key),
):
    try:
        pool = PostgresManager.pool()
        base_query = """
            SELECT
                   o.id,
                   o.event_id,
                   o.status,
                   o.created_at,
                   CASE WHEN o.status IN ('DONE', 'FAILED') THEN o.updated_at ELSE NULL END AS processed_at,
                   o.last_error AS error_message,
                   e.event_type, e.payload, e.actor
            FROM outbox o
            JOIN event_log e ON e.id = o.event_id
            WHERE (e.payload->>'project_id' = $1 OR e.payload->>'projectId' = $1)
        """
        args = [project_id]
        if status:
            base_query += " AND o.status = $2"
            args.append(status)
        
        base_query += f" ORDER BY o.created_at DESC LIMIT ${len(args) + 1}"
        args.append(limit)

        async with pool.acquire() as conn:
            rows = await conn.fetch(base_query, *args)
            
            result = []
            for r in rows:
                result.append({
                    "id": r["id"],
                    "event_id": r["event_id"],
                    "status": r["status"],
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                    "processed_at": r["processed_at"].isoformat() if r["processed_at"] else None,
                    "error_message": r["error_message"],
                    "event_type": r["event_type"],
                    "actor": r["actor"],
                    "payload": r["payload"]
                })
            return {"items": result}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/devices/{device_id}/status", status_code=status.HTTP_202_ACCEPTED, tags=["legacy"])
async def set_device_status(
    device_id: str,
    project_id: str = Query(..., min_length=1, description="Tenant/project scope ID"),
    req: dict | None = None,
):
    req = req or {}
    event_id = await EventRepository().append_event(
        event_type="DeviceStatusChanged",
        payload={
            "project_id": project_id,
            "device_id": device_id,
            "status": req.get("status", "UNKNOWN"),
            "name": device_id,
        },
        actor="api",
    )
    return {"device_id": device_id, "event_id": event_id, "note": "Queued for projection"}


@app.get("/devices", tags=["legacy"])
async def list_devices(
    project_id: str = Query(..., min_length=1, description="Tenant/project scope ID"),
):
    repo = GraphRepository(Neo4jManager.get_driver())
    rows = await repo.run_read(
        (
            "MATCH (e:Entity {projectId:$project_id, entityType:'Device'}) "
            "RETURN e.id AS id, e.name AS name, e.status AS status ORDER BY e.id"
        ),
        {"project_id": project_id},
    )
    return rows
