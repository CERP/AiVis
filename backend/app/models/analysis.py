"""Analysis is the first-class domain object tracking the automatic pipeline that runs after a
dataset finishes ingesting: data quality -> AI context -> Gemini findings -> recommendations ->
validation -> ranking -> persisted previews. One row per dataset version; its `status` is the
single source of truth the frontend polls (no separate "current_stage" field to drift out of
sync -- `status` *is* the current stage)."""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey
from sqlmodel import JSON, Column, Field

from app.models.base import TimestampedModel


class AnalysisStatus(StrEnum):
    QUEUED = "queued"
    PROFILING_QUALITY = "profiling_quality"
    BUILDING_AI_CONTEXT = "building_ai_context"
    AI_ANALYZING = "ai_analyzing"
    GENERATING_RECOMMENDATIONS = "generating_recommendations"
    VALIDATING = "validating"
    RANKING = "ranking"
    GENERATING_PREVIEWS = "generating_previews"
    READY = "ready"
    FAILED = "failed"


# Ordered stage sequence, terminal states excluded -- used to compute a real progress percentage
# (index in this list / len) rather than a fabricated number.
STAGE_ORDER: list[AnalysisStatus] = [
    AnalysisStatus.QUEUED,
    AnalysisStatus.PROFILING_QUALITY,
    AnalysisStatus.BUILDING_AI_CONTEXT,
    AnalysisStatus.AI_ANALYZING,
    AnalysisStatus.GENERATING_RECOMMENDATIONS,
    AnalysisStatus.VALIDATING,
    AnalysisStatus.RANKING,
    AnalysisStatus.GENERATING_PREVIEWS,
]


class Analysis(TimestampedModel, table=True):
    __tablename__ = "analyses"

    dataset_id: uuid.UUID = Field(
        sa_column=Column(ForeignKey("datasets.id", ondelete="CASCADE"), index=True)
    )
    dataset_version_id: uuid.UUID = Field(
        sa_column=Column(ForeignKey("dataset_versions.id", ondelete="CASCADE"), index=True)
    )
    status: AnalysisStatus = Field(default=AnalysisStatus.QUEUED, index=True)
    error: str | None = Field(default=None, max_length=2000)
    started_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    completed_at: datetime | None = Field(default=None, sa_type=DateTime(timezone=True))
    retry_count: int = Field(default=0)

    # Bumped when the pipeline logic or the Gemini prompt changes in a way that should
    # invalidate previously-cached results -- not used to gate behavior yet, just recorded per
    # the spec's idempotency/observability requirement.
    pipeline_version: int = Field(default=1)
    prompt_version: int = Field(default=1)

    data_quality: dict = Field(default_factory=dict, sa_column=Column(JSON))
    ai_findings: dict = Field(default_factory=dict, sa_column=Column(JSON))
    recommendations: dict = Field(default_factory=dict, sa_column=Column(JSON))
    """Frozen snapshot of `{top, derived, shortfall_reason}` -- persisted once computed so
    results survive a page refresh and are never silently recomputed differently later."""
