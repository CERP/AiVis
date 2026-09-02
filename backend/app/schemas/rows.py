from pydantic import BaseModel


class DatasetRowsResponse(BaseModel):
    dataset_version_id: str
    total_row_count: int
    returned_row_count: int
    rows: list[dict]
