import asyncio
from pathlib import Path
from neo4j import AsyncGraphDatabase
from dotenv import load_dotenv
import os

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:17687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "neo4j_password_change_me")
DB = os.getenv("NEO4J_DATABASE", "neo4j")

MIG_DIR = Path(__file__).resolve().parents[1] / "app" / "migrations"

async def main():
    driver = AsyncGraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    try:
        files = sorted(MIG_DIR.glob("neo4j_*.cypher"))
        async with driver.session(database=DB) as session:
            for f in files:
                cypher = f.read_text(encoding="utf-8")
                # 세미콜론으로 구분된 각 구문을 개별 실행
                # -- 주석 라인 제거 후 세미콜론으로 분리
                def strip_comments(text: str) -> str:
                    lines = [l for l in text.splitlines() if not l.strip().startswith("--")]
                    return "\n".join(lines)
                statements = [strip_comments(s).strip() for s in cypher.split(";") if strip_comments(s).strip()]
                for stmt in statements:
                    await session.execute_write(lambda tx, q=stmt: tx.run(q))
                print(f"APPLIED: {f.name} ({len(statements)} statements)")
    finally:
        await driver.close()

if __name__ == "__main__":
    asyncio.run(main())
