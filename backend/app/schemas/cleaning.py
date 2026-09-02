import uuid

from pydantic import BaseModel


class CleaningRequest(BaseModel):
    operation_type: str
    column_name: str | None = None
    params: dict = {}


class CleaningResponse(BaseModel):
    new_version_id: uuid.UUID
    version_number: int
    row_count: int
    column_count: int
    valid_count: int
    invalid_count: int

    model_config = {"from_attributes": True}
