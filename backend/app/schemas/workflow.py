from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.ai.schemas import DatasetAnomaly, DatasetQualityStatus, DynamicTransformStep


class WorkflowPreview(BaseModel):
    rows: list[dict[str, Any]]


class ValidationWorkflowResponse(BaseModel):
    audit_id: uuid.UUID
    source_version_id: uuid.UUID
    cleaned_version_id: uuid.UUID | None
    workflow_status: str
    dataset_status: DatasetQualityStatus
    data_quality_score_before: int
    data_quality_score_after: int | None
    columns: list[str]
    before: WorkflowPreview
    after: WorkflowPreview
    anomalies: list[DatasetAnomaly]
    remaining_issues: list[DatasetAnomaly]
    cleaning_recipe: list[DynamicTransformStep]
    cleaning_summary: list[str]
    changed_cells: int
    changed_rows: int
    removed_rows: int
    validation_errors: list[str]


class WorkflowSelectionRequest(BaseModel):
    audit_id: uuid.UUID
    selection: Literal["original", "cleaned"]
    # Additive, backward-compatible: omitted/null means "apply the full recipe" (current
    # behavior, unchanged). Recipe steps have no stable id of their own, so position in
    # `cleaning_recipe` -- which is immutable once an audit is cached -- is the contract here,
    # not a synthetic id. Only meaningful when selection == "cleaned"; ignored for "original".
    selected_step_indices: list[int] | None = None


class WorkflowSelectionResponse(BaseModel):
    dataset_version_id: uuid.UUID
    version_number: int
    selection: Literal["original", "cleaned"]
    cleaned_version_created: bool = False
    analysis_status: str = "queued"


class DatasetExportFormat(BaseModel):
    format: Literal["csv", "xlsx"] = Field(default="csv")
