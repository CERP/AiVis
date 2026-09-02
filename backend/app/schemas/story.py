import uuid
from datetime import datetime

from pydantic import BaseModel


class StoryResponse(BaseModel):
    id: uuid.UUID
    dataset_version_id: uuid.UUID
    insight_id: uuid.UUID | None
    title: str
    description: str
    analytical_question: str
    relevant_fields: list[str]
    recommended_chart_type: str | None
    confidence: float
    created_at: datetime

    model_config = {"from_attributes": True}
