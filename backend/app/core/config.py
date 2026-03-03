"""
애플리케이션 설정.
pydantic-settings를 사용해 환경변수 + .env 파일을 타입 안전하게 로드.
"""
from functools import cached_property

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Neo4j
    neo4j_uri: str = "bolt://localhost:17687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "neo4j_password_change_me"
    neo4j_database: str = "neo4j"

    # Postgres
    pg_host: str = "localhost"
    pg_port: int = 5435
    pg_db: str = "ha_core"
    pg_user: str = "ha"
    pg_password: str = "ha_password_change_me"

    # API
    api_key: str = ""            # 비어있으면 개발 모드 (인증 생략)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    log_level: str = "INFO"
    app_title: str = "Neo4j+Postgres Dev Stack"
    app_version: str = "1.0.0"

    @cached_property
    def cors_origins_list(self) -> list[str]:
        origins = [item.strip() for item in self.cors_origins.split(",") if item.strip()]
        return origins or ["http://localhost:5173"]


settings = Settings()
