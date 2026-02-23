"""
ProjectionWorker._apply_event unit tests.
"""
import pytest
from unittest.mock import AsyncMock

from app.repositories.graph_repository import GraphRepository
from app.services.projection_worker import ProjectionWorker


@pytest.fixture
def mock_graph_repo():
    return AsyncMock(spec=GraphRepository)


@pytest.fixture
def worker(mock_graph_repo):
    return ProjectionWorker(mock_graph_repo)


@pytest.mark.asyncio
async def test_entity_created(worker, mock_graph_repo):
    payload = {
        "project_id": "project-a",
        "entity_id": "e-1",
        "entity_type": "Device",
        "name": "Dev1",
        "attributes": {},
    }
    await worker._apply_event("EntityCreated", payload)
    mock_graph_repo.upsert_entity.assert_called_once_with("project-a", "e-1", "Device", "Dev1", {})


@pytest.mark.asyncio
async def test_entity_deleted(worker, mock_graph_repo):
    payload = {"project_id": "project-a", "entity_id": "e-1", "entity_type": "Device"}
    await worker._apply_event("EntityDeleted", payload)
    mock_graph_repo.delete_entity.assert_called_once_with("project-a", "e-1")


@pytest.mark.asyncio
async def test_status_changed(worker, mock_graph_repo):
    payload = {
        "project_id": "project-a",
        "entity_id": "e-1",
        "entity_type": "Device",
        "new_status": "OFFLINE",
    }
    await worker._apply_event("StatusChanged", payload)
    mock_graph_repo.set_status.assert_called_once_with("project-a", "e-1", "OFFLINE")


@pytest.mark.asyncio
async def test_attribute_changed(worker, mock_graph_repo):
    payload = {
        "project_id": "project-a",
        "entity_id": "e-1",
        "entity_type": "Service",
        "attribute_key": "port",
        "new_value": 9090,
    }
    await worker._apply_event("AttributeChanged", payload)
    mock_graph_repo.set_attribute.assert_called_once_with("project-a", "e-1", "port", 9090)


@pytest.mark.asyncio
async def test_relationship_established(worker, mock_graph_repo):
    payload = {
        "project_id": "project-a",
        "from_id": "e-1",
        "from_type": "Device",
        "to_id": "e-2",
        "to_type": "Service",
        "rel_type": "DEPENDS_ON",
        "properties": {"weight": 1},
    }
    await worker._apply_event("RelationshipEstablished", payload)
    mock_graph_repo.upsert_relationship.assert_called_once_with(
        "project-a", "e-1", "e-2", "DEPENDS_ON", {"weight": 1}
    )


@pytest.mark.asyncio
async def test_relationship_removed(worker, mock_graph_repo):
    payload = {
        "project_id": "project-a",
        "from_id": "e-1",
        "from_type": "Device",
        "to_id": "e-2",
        "to_type": "Service",
        "rel_type": "DEPENDS_ON",
    }
    await worker._apply_event("RelationshipRemoved", payload)
    mock_graph_repo.remove_relationship.assert_called_once_with("project-a", "e-1", "e-2", "DEPENDS_ON")


@pytest.mark.asyncio
async def test_device_status_changed_legacy(worker, mock_graph_repo):
    payload = {
        "project_id": "project-a",
        "device_id": "dev-1",
        "status": "OFFLINE",
        "name": "Dev One",
    }
    await worker._apply_event("DeviceStatusChanged", payload)
    mock_graph_repo.upsert_device.assert_called_once_with("project-a", "dev-1", "Dev One", "OFFLINE")


@pytest.mark.asyncio
async def test_invalid_payload_raises(worker):
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        await worker._apply_event("EntityCreated", {"entity_id": "e-1", "entity_type": "Device"})
