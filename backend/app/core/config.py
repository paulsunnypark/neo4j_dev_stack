import os

from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()


class Settings(BaseModel):
    neo4j_uri: str = os.getenv("NEO4J_URI", "neo4j://localhost:7687")
    neo4j_user: str = os.getenv("NEO4J_USER", "neo4j")
    neo4j_password: str = os.getenv("NEO4J_PASSWORD", "neo4j_password_change_me")
    neo4j_database: str = os.getenv("NEO4J_DATABASE", "neo4j")

    pg_host: str = os.getenv("PG_HOST", "localhost")
    pg_port: int = int(os.getenv("PG_PORT", "5432"))
    pg_db: str = os.getenv("PG_DB", "ha_core")
    pg_user: str = os.getenv("PG_USER", "ha")
    pg_password: str = os.getenv("PG_PASSWORD", "ha_password_change_me")


settings = Settings()
