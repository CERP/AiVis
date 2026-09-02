import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.dataset import DatasetStatus


class DatasetResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    original_filename: str
    mime_type: str
    size_bytes: int
    status: DatasetStatus
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
