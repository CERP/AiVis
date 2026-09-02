import uuid

from sqlmodel import JSON, Column, Field

from app.models.base import TimestampedModel


class AuditLog(TimestampedModel, table=True):
    __tablename__ = "audit_logs"

    user_id: uuid.UUID | None = Field(default=None, foreign_key="users.id", index=True)
    organization_id: uuid.UUID | None = Field(
        default=None, foreign_key="organizations.id", index=True
    )
    action: str = Field(max_length=200)
    resource_type: str = Field(max_length=100)
    resource_id: uuid.UUID | None = Field(default=None)
    metadata_: dict = Field(default_factory=dict, sa_column=Column("metadata", JSON))
