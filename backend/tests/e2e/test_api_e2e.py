"""
FastAPI E2E tests with mocked DB dependencies.
"""
import pytest
from unittest.mock import AsyncMock


class TestHealth:
    @pytest.mark.asyncio
    async def test_health_ok(self, async_client):
        resp = await async_client.get("/health")
        assert resp.status_code == 200


class TestEntitiesAPI:
    @pytest.mark.asyncio
    async def test_create_entity_accepted(self, async_client, mock_pg_conn):
        mock_pg_conn.fetchrow = AsyncMock(return_value={"id": 42})
        resp = await async_client.post(
            "/entities",
            json={
                "project_id": "project-a",
                "entity_id": "test-e-1",
                "entity_type": "Device",
                "name": "Test Device",
            },
        )
        assert resp.status_code == 202

    @pytest.mark.asyncio
    async def test_create_entity_missing_project_id(self, async_client):
        resp = await async_client.post("/entities", json={"entity_id": "test-e-1", "entity_type": "Device"})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_list_entities_requires_project_id(self, async_client):
        resp = await async_client.get("/entities")
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_list_entities_ok(self, async_client):
        resp = await async_client.get("/entities?project_id=project-a&page=1&size=10")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_change_status_accepted(self, async_client, mock_pg_conn):
        mock_pg_conn.fetchrow = AsyncMock(return_value={"id": 10})
        resp = await async_client.post(
            "/entities/e-1/status",
            json={
                "project_id": "project-a",
                "entity_id": "e-1",
                "entity_type": "Device",
                "new_status": "OFFLINE",
            },
        )
        assert resp.status_code == 202

    @pytest.mark.asyncio
    async def test_delete_entity_requires_project_id(self, async_client):
        resp = await async_client.delete("/entities/e-1?entity_type=Device")
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_entity_accepted(self, async_client, mock_pg_conn):
        mock_pg_conn.fetchrow = AsyncMock(return_value={"id": 20})
        resp = await async_client.delete("/entities/e-1?project_id=project-a&entity_type=Device")
        assert resp.status_code == 202


class TestRelationshipsAPI:
    @pytest.mark.asyncio
    async def test_create_relationship_accepted(self, async_client, mock_pg_conn):
        mock_pg_conn.fetchrow = AsyncMock(return_value={"id": 5})
        resp = await async_client.post(
            "/relationships",
            json={
                "project_id": "project-a",
                "from_id": "e-1",
                "from_type": "Device",
                "to_id": "e-2",
                "to_type": "Service",
                "rel_type": "DEPENDS_ON",
            },
        )
        assert resp.status_code == 202

    @pytest.mark.asyncio
    async def test_remove_relationship_accepted(self, async_client, mock_pg_conn):
        mock_pg_conn.fetchrow = AsyncMock(return_value={"id": 6})
        resp = await async_client.request(
            "DELETE",
            "/relationships",
            json={
                "project_id": "project-a",
                "from_id": "e-1",
                "from_type": "Device",
                "to_id": "e-2",
                "to_type": "Service",
                "rel_type": "DEPENDS_ON",
            },
        )
        assert resp.status_code == 202


class TestLegacyAPI:
    @pytest.mark.asyncio
    async def test_legacy_device_status(self, async_client, mock_pg_conn):
        mock_pg_conn.fetchrow = AsyncMock(return_value={"id": 1})
        resp = await async_client.post("/devices/dev-1/status?project_id=project-a", json={"status": "OFFLINE"})
        assert resp.status_code == 202

    @pytest.mark.asyncio
    async def test_legacy_list_devices_requires_project_id(self, async_client):
        resp = await async_client.get("/devices")
        assert resp.status_code == 422


class TestOutboxStats:
    @pytest.mark.asyncio
    async def test_outbox_stats_requires_project_id(self, async_client):
        resp = await async_client.get("/outbox/stats")
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_outbox_stats(self, async_client, mock_pg_conn):
        mock_pg_conn.fetch = AsyncMock(return_value=[{"status": "DONE", "cnt": 10}, {"status": "PENDING", "cnt": 2}])
        resp = await async_client.get("/outbox/stats?project_id=project-a")
        assert resp.status_code == 200
