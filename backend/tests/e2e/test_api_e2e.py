"""
FastAPI E2E 테스트.
실제 DB 없이 ASGITransport + mock DB로 전체 API 흐름 검증.
"""
import pytest
from unittest.mock import AsyncMock, patch


class TestHealth:
    @pytest.mark.asyncio
    async def test_health_ok(self, async_client):
        resp = await async_client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "ok" in data
        assert "neo4j" in data
        assert "postgres" in data
        assert "version" in data


class TestEntitiesAPI:
    @pytest.mark.asyncio
    async def test_create_entity_accepted(self, async_client, mock_pg_conn):
        mock_pg_conn.fetchrow = AsyncMock(return_value={"id": 42})
        resp = await async_client.post("/entities", json={
            "entity_id": "test-e-1",
            "entity_type": "Device",
            "name": "Test Device",
        })
        assert resp.status_code == 202
        data = resp.json()
        assert "event_id" in data
        assert "note" in data

    @pytest.mark.asyncio
    async def test_create_entity_missing_field(self, async_client):
        """entity_type 누락 시 422 반환."""
        resp = await async_client.post("/entities", json={
            "entity_id": "test-e-1",
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_list_entities_default_pagination(self, async_client, mock_neo4j_driver):
        session = AsyncMock()
        mock_neo4j_driver.session.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_neo4j_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)
        # read_tx가 빈 리스트 반환
        result_mock = AsyncMock()
        result_mock.__aiter__ = AsyncMock(return_value=iter([]))
        session.execute_read = AsyncMock(return_value=[])

        resp = await async_client.get("/entities")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "size" in data
        assert "pages" in data

    @pytest.mark.asyncio
    async def test_list_entities_pagination_params(self, async_client):
        resp = await async_client.get("/entities?page=2&size=10&entity_type=Device")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_entities_size_limit(self, async_client):
        """size > 100 이면 422."""
        resp = await async_client.get("/entities?size=200")
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_change_status_accepted(self, async_client, mock_pg_conn):
        mock_pg_conn.fetchrow = AsyncMock(return_value={"id": 10})
        resp = await async_client.post("/entities/e-1/status", json={
            "entity_id": "e-1",
            "entity_type": "Device",
            "new_status": "OFFLINE",
        })
        assert resp.status_code == 202

    @pytest.mark.asyncio
    async def test_delete_entity_requires_entity_type(self, async_client):
        """entity_type 쿼리파라미터 없으면 422."""
        resp = await async_client.delete("/entities/e-1")
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_delete_entity_accepted(self, async_client, mock_pg_conn):
        mock_pg_conn.fetchrow = AsyncMock(return_value={"id": 20})
        resp = await async_client.delete("/entities/e-1?entity_type=Device")
        assert resp.status_code == 202


class TestRelationshipsAPI:
    @pytest.mark.asyncio
    async def test_create_relationship_accepted(self, async_client, mock_pg_conn):
        mock_pg_conn.fetchrow = AsyncMock(return_value={"id": 5})
        resp = await async_client.post("/relationships", json={
            "from_id": "e-1", "from_type": "Device",
            "to_id": "e-2", "to_type": "Service",
            "rel_type": "DEPENDS_ON",
        })
        assert resp.status_code == 202

    @pytest.mark.asyncio
    async def test_remove_relationship_accepted(self, async_client, mock_pg_conn):
        mock_pg_conn.fetchrow = AsyncMock(return_value={"id": 6})
        resp = await async_client.request("DELETE", "/relationships", json={
            "from_id": "e-1", "from_type": "Device",
            "to_id": "e-2", "to_type": "Service",
            "rel_type": "DEPENDS_ON",
        })
        assert resp.status_code == 202


class TestLegacyAPI:
    @pytest.mark.asyncio
    async def test_legacy_device_status(self, async_client, mock_pg_conn):
        mock_pg_conn.fetchrow = AsyncMock(return_value={"id": 1})
        resp = await async_client.post("/devices/dev-1/status", json={"status": "OFFLINE"})
        assert resp.status_code == 202

    @pytest.mark.asyncio
    async def test_legacy_list_devices(self, async_client, mock_neo4j_driver):
        session = AsyncMock()
        mock_neo4j_driver.session.return_value.__aenter__ = AsyncMock(return_value=session)
        mock_neo4j_driver.session.return_value.__aexit__ = AsyncMock(return_value=False)
        session.execute_read = AsyncMock(return_value=[])
        resp = await async_client.get("/devices")
        assert resp.status_code == 200


class TestOutboxStats:
    @pytest.mark.asyncio
    async def test_outbox_stats(self, async_client, mock_pg_conn):
        mock_pg_conn.fetch = AsyncMock(return_value=[
            {"status": "DONE", "cnt": 10},
            {"status": "PENDING", "cnt": 2},
        ])
        resp = await async_client.get("/outbox/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "DONE" in data or "PENDING" in data
