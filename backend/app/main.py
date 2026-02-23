import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel

from app.core.neo4j import Neo4jManager
from app.core.postgres import PostgresManager
from app.repositories.event_repository import EventRepository
from app.repositories.graph_repository import GraphRepository
from app.services.projection_worker import ProjectionWorker
from app.services.simulation_service import SimulationService

_worker: ProjectionWorker | None = None
_worker_task: asyncio.Task | None = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _worker, _worker_task
    # startup
    Neo4jManager.get_driver()
    await PostgresManager.init()
    _worker = ProjectionWorker(GraphRepository(Neo4jManager.get_driver()))
    _worker_task = asyncio.create_task(_worker.run_forever())

    yield

    # shutdown
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

app = FastAPI(title="HA/Matter Neo4j+Postgres Dev Stack", lifespan=lifespan)

class StatusReq(BaseModel):
    status: str

@app.get("/health")
async def health():
    return {"ok": True}

@app.post("/devices/{device_id}/status")
async def set_status(device_id: str, req: StatusReq):
    svc = SimulationService(EventRepository())
    await svc.set_device_status(device_id, req.status, actor="api")
    return {
        "device_id": device_id,
        "status": req.status,
        "note": "Recorded to Postgres (outbox pending projection)"
    }

@app.get("/devices")
async def list_devices_from_neo4j():
    repo = GraphRepository(Neo4jManager.get_driver())
    rows = await repo.run_read(
        "MATCH (d:Device) RETURN d.id AS id, d.name AS name, d.status AS status ORDER BY id"
    )
    return rows
