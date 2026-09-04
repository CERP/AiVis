import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.visualization.commands import VisualizationCommand
from app.visualization.spec import VisualizationSpec


class CreateVisualizationRequest(BaseModel):
    title: str
    story_id: uuid.UUID | None = None
    spec: VisualizationSpec


class ApplyCommandRequest(BaseModel):
    command: VisualizationCommand


class NLEditRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)


class VisualizationResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    dataset_id: uuid.UUID
    dataset_version_id: uuid.UUID
    story_id: uuid.UUID | None
    title: str
    current_version_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class VisualizationVersionResponse(BaseModel):
    id: uuid.UUID
    visualization_id: uuid.UUID
    version_number: int
    spec: VisualizationSpec
    change_summary: str | None
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}
