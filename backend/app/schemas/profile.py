import uuid

from pydantic import BaseModel


class ColumnProfileResponse(BaseModel):
    id: uuid.UUID
    name: str
    ordinal: int
    raw_type: str
    semantic_type: str | None
    is_pii: bool
    null_count: int
    unique_count: int
    stats: dict

    model_config = {"from_attributes": True}


class DatasetProfileResponse(BaseModel):
    dataset_version_id: uuid.UUID
    row_count: int
    column_count: int
    columns: list[ColumnProfileResponse]
