"""
API Key 인증.
X-API-Key 헤더 기반. api_key 환경변수가 비어있으면 개발 모드로 인증 생략.
"""
from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from app.core.config import settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str = Security(_api_key_header)) -> str:
    if not settings.api_key:
        # API Key 미설정 시 개발 모드 — 인증 생략
        return "anonymous"
    if api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing API Key. Set X-API-Key header.",
        )
    return api_key
