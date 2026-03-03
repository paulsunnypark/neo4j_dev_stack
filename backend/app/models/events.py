"""
범용 이벤트 payload 스키마.
Pydantic 모델로 validation과 OpenAPI 문서화를 동시에 처리.
"""
from __future__ import annotations
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class EntityCreatedPayload(BaseModel):
    project_id: str
    entity_id: str
    entity_type: str          # "Device", "Service", "User", "Resource", "Group" 등 자유 형식
    name: Optional[str] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"json_schema_extra": {"example": {
        "project_id": "project-a",
        "entity_id": "svc-1", "entity_type": "Service",
        "name": "My Service", "attributes": {"port": 8080}
    }}}


class EntityDeletedPayload(BaseModel):
    project_id: str
    entity_id: str
    entity_type: str

    model_config = {"json_schema_extra": {"example": {
        "project_id": "project-a",
        "entity_id": "svc-1", "entity_type": "Service"
    }}}


class AttributeChangedPayload(BaseModel):
    project_id: str
    entity_id: str
    entity_type: str
    attribute_key: str
    old_value: Optional[Any] = None
    new_value: Any

    model_config = {"json_schema_extra": {"example": {
        "project_id": "project-a",
        "entity_id": "svc-1", "entity_type": "Service",
        "attribute_key": "port", "old_value": 8080, "new_value": 9090
    }}}


class RelationshipEstablishedPayload(BaseModel):
    project_id: str
    from_id: str
    from_type: str
    to_id: str
    to_type: str
    rel_type: str             # "DEPENDS_ON", "CONNECTED_TO", "BELONGS_TO", "HAS_ATTRIBUTE"
    properties: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"json_schema_extra": {"example": {
        "project_id": "project-a",
        "from_id": "entity-1", "from_type": "Device",
        "to_id": "svc-1", "to_type": "Service",
        "rel_type": "DEPENDS_ON", "properties": {}
    }}}


class RelationshipRemovedPayload(BaseModel):
    project_id: str
    from_id: str
    from_type: str
    to_id: str
    to_type: str
    rel_type: str

    model_config = {"json_schema_extra": {"example": {
        "project_id": "project-a",
        "from_id": "entity-1", "from_type": "Device",
        "to_id": "svc-1", "to_type": "Service",
        "rel_type": "DEPENDS_ON"
    }}}


class StatusChangedPayload(BaseModel):
    project_id: str
    entity_id: str
    entity_type: str
    old_status: Optional[str] = None
    new_status: str

    model_config = {"json_schema_extra": {"example": {
        "project_id": "project-a",
        "entity_id": "entity-1", "entity_type": "Device",
        "old_status": "ONLINE", "new_status": "OFFLINE"
    }}}


EventTypeLiteral = Literal[
    "EntityCreated",
    "EntityDeleted",
    "AttributeChanged",
    "RelationshipEstablished",
    "RelationshipRemoved",
    "StatusChanged",
]


class BatchEventItem(BaseModel):
    event_type: EventTypeLiteral
    payload: Dict[str, Any]
    actor: Optional[str] = "api"


class BatchEventRequest(BaseModel):
    events: List[BatchEventItem] = Field(default_factory=list)
