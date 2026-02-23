"""
공통 pytest 픽스처.
DB 의존성을 AsyncMock으로 대체하여 실제 DB 없이 단위/E2E 테스트 실행 가능.
"""
import asyncio
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import AsyncClient, ASGITransport

from app.repositories.graph_repository import GraphRepository


# ── Neo4j Mock ──────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_neo4j_driver():
    driver = MagicMock()
    session = AsyncMock()
    # session의 execute_read/write 기본값
    session.execute_read = AsyncMock(return_value=[])
    session.execute_write = AsyncMock(return_value=None)
    # driver.session()이 async context manager를 반환하도록 설정
    session_ctx = MagicMock()
    session_ctx.__aenter__ = AsyncMock(return_value=session)
    session_ctx.__aexit__ = AsyncMock(return_value=False)
    driver.session = MagicMock(return_value=session_ctx)
    driver.verify_connectivity = AsyncMock(return_value=None)
    return driver


@pytest.fixture
def graph_repo(mock_neo4j_driver):
    return GraphRepository(mock_neo4j_driver)


# ── Postgres Mock ───────────────────────────────────────────────────────────────

@pytest.fixture
def mock_pg_conn():
    conn = AsyncMock()
    # transaction() 컨텍스트 매니저 - MagicMock으로 동기적 __enter__/__exit__ 제공
    tx_ctx = MagicMock()
    tx_ctx.__aenter__ = AsyncMock(return_value=None)
    tx_ctx.__aexit__ = AsyncMock(return_value=False)
    conn.transaction = MagicMock(return_value=tx_ctx)
    conn.fetchval = AsyncMock(return_value=1)
    conn.fetchrow = AsyncMock(return_value={"id": 1})
    conn.fetch = AsyncMock(return_value=[])
    conn.execute = AsyncMock(return_value=None)
    return conn


@pytest.fixture
def mock_pg_pool(mock_pg_conn):
    pool = MagicMock()
    # acquire()는 async context manager여야 함
    acquire_ctx = MagicMock()
    acquire_ctx.__aenter__ = AsyncMock(return_value=mock_pg_conn)
    acquire_ctx.__aexit__ = AsyncMock(return_value=False)
    pool.acquire = MagicMock(return_value=acquire_ctx)
    return pool


# ── FastAPI E2E 클라이언트 ───────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def async_client(mock_neo4j_driver, mock_pg_pool):
    """
    실제 DB 없이 FastAPI app을 테스트하는 비동기 클라이언트.
    DB 연결을 mock으로 교체하여 lifespan 없이 동작.
    API_KEY를 빈 문자열로 override하여 인증을 개발 모드(dev mode)로 우회.
    """
    from app.main import app
    from app.core.neo4j import Neo4jManager
    from app.core.postgres import PostgresManager
    from app.core import config as core_config

    with patch.object(Neo4jManager, "get_driver", return_value=mock_neo4j_driver), \
         patch.object(PostgresManager, "pool", return_value=mock_pg_pool), \
         patch.object(PostgresManager, "init", new_callable=AsyncMock), \
         patch.object(PostgresManager, "close", new_callable=AsyncMock), \
         patch.object(Neo4jManager, "close", new_callable=AsyncMock), \
         patch.object(core_config.settings, "api_key", ""):  # dev mode: 인증 생략

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
