"""
Pydantic 이벤트 모델 유효성 검증 단위 테스트.
"""
import pytest
from pydantic import ValidationError

from app.models.events import (
    AttributeChangedPayload,
    EntityCreatedPayload,
    RelationshipEstablishedPayload,
    StatusChangedPayload,
)


class TestEntityCreatedPayload:
    def test_valid_minimal(self):
        p = EntityCreatedPayload(project_id="project-a", entity_id="e-1", entity_type="Device")
        assert p.project_id == "project-a"
        assert p.entity_id == "e-1"
        assert p.entity_type == "Device"
        assert p.name is None
        assert p.attributes == {}

    def test_valid_full(self):
        p = EntityCreatedPayload(
            project_id="project-a",
            entity_id="e-1",
            entity_type="Service",
            name="My Service",
            attributes={"port": 8080},
        )
        assert p.name == "My Service"
        assert p.attributes["port"] == 8080

    def test_missing_project_id_raises(self):
        with pytest.raises(ValidationError):
            EntityCreatedPayload(entity_id="e-1", entity_type="Device")


class TestStatusChangedPayload:
    def test_old_status_is_optional(self):
        p = StatusChangedPayload(
            project_id="project-a", entity_id="e-1", entity_type="Device", new_status="OFFLINE"
        )
        assert p.old_status is None
        assert p.new_status == "OFFLINE"


class TestRelationshipEstablishedPayload:
    def test_valid(self):
        p = RelationshipEstablishedPayload(
            project_id="project-a",
            from_id="a",
            from_type="Device",
            to_id="b",
            to_type="Service",
            rel_type="DEPENDS_ON",
        )
        assert p.project_id == "project-a"
        assert p.rel_type == "DEPENDS_ON"
        assert p.properties == {}


class TestAttributeChangedPayload:
    def test_valid(self):
        p = AttributeChangedPayload(
            project_id="project-a",
            entity_id="e-1",
            entity_type="Service",
            attribute_key="port",
            new_value=9090,
        )
        assert p.old_value is None
        assert p.new_value == 9090
