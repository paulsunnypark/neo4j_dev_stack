import asyncio

from app.core.neo4j import Neo4jManager
from app.core.postgres import PostgresManager
from app.repositories.graph_repository import GraphRepository
from app.services.projection_worker import ProjectionWorker


async def main():
    Neo4jManager.get_driver()
    await PostgresManager.init()

    worker = ProjectionWorker(GraphRepository(Neo4jManager.get_driver()))
    try:
        await worker.run_forever()
    finally:
        await PostgresManager.close()
        await Neo4jManager.close()


if __name__ == "__main__":
    asyncio.run(main())
