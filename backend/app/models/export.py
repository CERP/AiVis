import uuid
from enum import StrEnum

from sqlmodel import Field

from app.models.base import TimestampedModel


class ExportFormat(StrEnum):
    SVG = "svg"
    PNG = "png"
    PDF = "pdf"
    JSON = "json"


class ExportStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class Export(TimestampedModel, table=True):
    __tablename__ = "exports"

    visualization_version_id: uuid.UUID = Field(foreign_key="visualization_versions.id", index=True)
    format: ExportFormat
    status: ExportStatus = Field(default=ExportStatus.PENDING)
    object_key: str | None = Field(default=None, max_length=1000)
    error_message: str | None = Field(default=None, max_length=2000)
