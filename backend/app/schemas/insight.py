import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.insight import InsightType


class InsightResponse(BaseModel):
    id: uuid.UUID
    dataset_version_id: uuid.UUID
    type: InsightType
    title: str
    description: str
    fields: list[str]
    calculation: dict
    confidence: float
    created_at: datetime

    model_config = {"from_attributes": True}
