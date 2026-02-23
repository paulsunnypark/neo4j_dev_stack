import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from neo4j import AsyncGraphDatabase

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI", "neo4j://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "neo4j_password_change_me")
DB = os.getenv("NEO4J_DATABASE", "neo4j")

MIG_DIR = Path(__file__).resolve().parents[1] / "app" / "migrations"


async def main():
    driver = AsyncGraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    try:
        files = sorted(MIG_DIR.glob("neo4j_*.cypher"))
        async with driver.session(database=DB) as session:
            for file in files:
                cypher = file.read_text(encoding="utf-8")
                await session.execute_write(lambda tx, q=cypher: tx.run(q))
                print(f"APPLIED: {file.name}")
    finally:
        await driver.close()


if __name__ == "__main__":
    asyncio.run(main())
