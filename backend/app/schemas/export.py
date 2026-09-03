import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.export import ExportFormat, ExportStatus


class ExportResponse(BaseModel):
    id: uuid.UUID
    visualization_version_id: uuid.UUID
    format: ExportFormat
    status: ExportStatus
    download_url: str | None
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
