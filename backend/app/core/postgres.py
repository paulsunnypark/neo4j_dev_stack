import asyncpg

from app.core.config import settings


class PostgresManager:
    _pool: asyncpg.Pool | None = None

    @classmethod
    async def init(cls):
        if cls._pool is None:
            cls._pool = await asyncpg.create_pool(
                host=settings.pg_host,
                port=settings.pg_port,
                user=settings.pg_user,
                password=settings.pg_password,
                database=settings.pg_db,
                min_size=1,
                max_size=10,
            )

    @classmethod
    def pool(cls) -> asyncpg.Pool:
        if cls._pool is None:
            raise RuntimeError("Postgres pool is not initialized. Call PostgresManager.init()")
        return cls._pool

    @classmethod
    async def close(cls):
        if cls._pool is not None:
            await cls._pool.close()
            cls._pool = None
