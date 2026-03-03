"""
API 표준 응답 모델.
"""
from __future__ import annotations
from typing import Any, Dict, Generic, List, Optional, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class PagedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    size: int
    pages: int


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None


class HealthResponse(BaseModel):
    ok: bool
    neo4j: bool
    postgres: bool
    version: str = "1.0.0"


class EventQueued(BaseModel):
    event_id: int
    note: str = "Queued for projection"


class BatchEventQueued(BaseModel):
    event_ids: List[int]
    count: int
    note: str = "Queued for projection"
