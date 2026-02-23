from neo4j import AsyncGraphDatabase
from .config import settings

class Neo4jManager:
    _driver = None

    @classmethod
    def get_driver(cls):
        if cls._driver is None:
            cls._driver = AsyncGraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password),
                max_connection_pool_size=50,
            )
        return cls._driver

    @classmethod
    async def close(cls):
        if cls._driver is not None:
            await cls._driver.close()
            cls._driver = None
