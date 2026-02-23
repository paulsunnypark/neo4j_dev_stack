"""
Pydantic 이벤트 모델 유효성 검증 단위 테스트.
"""
import pytest
from pydantic import ValidationError

from app.models.events import (
    AttributeChangedPayload,
    EntityCreatedPayload,
    EntityDeletedPayload,
    RelationshipEstablishedPayload,
    RelationshipRemovedPayload,
    StatusChangedPayload,
)


class TestEntityCreatedPayload:
    def test_valid_minimal(self):
        p = EntityCreatedPayload(entity_id="e-1", entity_type="Device")
        assert p.entity_id == "e-1"
        assert p.entity_type == "Device"
        assert p.name is None
        assert p.attributes == {}

    def test_valid_full(self):
        p = EntityCreatedPayload(
            entity_id="e-1", entity_type="Service",
            name="My Service", attributes={"port": 8080}
        )
        assert p.name == "My Service"
        assert p.attributes["port"] == 8080

    def test_missing_entity_id_raises(self):
        with pytest.raises(ValidationError):
            EntityCreatedPayload(entity_type="Device")

    def test_missing_entity_type_raises(self):
        with pytest.raises(ValidationError):
            EntityCreatedPayload(entity_id="e-1")


class TestStatusChangedPayload:
    def test_old_status_is_optional(self):
        p = StatusChangedPayload(entity_id="e-1", entity_type="Device", new_status="OFFLINE")
        assert p.old_status is None
        assert p.new_status == "OFFLINE"

    def test_with_old_status(self):
        p = StatusChangedPayload(
            entity_id="e-1", entity_type="Device",
            old_status="ONLINE", new_status="OFFLINE"
        )
        assert p.old_status == "ONLINE"


class TestRelationshipEstablishedPayload:
    def test_valid(self):
        p = RelationshipEstablishedPayload(
            from_id="a", from_type="Device",
            to_id="b", to_type="Service",
            rel_type="DEPENDS_ON",
        )
        assert p.rel_type == "DEPENDS_ON"
        assert p.properties == {}

    def test_with_properties(self):
        p = RelationshipEstablishedPayload(
            from_id="a", from_type="Device",
            to_id="b", to_type="Service",
            rel_type="CONNECTED_TO",
            properties={"since": "2024-01-01"},
        )
        assert p.properties["since"] == "2024-01-01"

    def test_missing_rel_type_raises(self):
        with pytest.raises(ValidationError):
            RelationshipEstablishedPayload(
                from_id="a", from_type="Device",
                to_id="b", to_type="Service",
            )


class TestAttributeChangedPayload:
    def test_valid(self):
        p = AttributeChangedPayload(
            entity_id="e-1", entity_type="Service",
            attribute_key="port", new_value=9090
        )
        assert p.old_value is None
        assert p.new_value == 9090

    def test_any_value_type(self):
        p = AttributeChangedPayload(
            entity_id="e-1", entity_type="Service",
            attribute_key="tags", new_value=["prod", "v2"]
        )
        assert p.new_value == ["prod", "v2"]
