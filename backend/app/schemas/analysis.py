import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.analysis import STAGE_ORDER, Analysis, AnalysisStatus

StageState = str  # "complete" | "processing" | "pending"


class AnalysisResponse(BaseModel):
    id: uuid.UUID
    dataset_id: uuid.UUID
    dataset_version_id: uuid.UUID
    status: AnalysisStatus
    progress: int
    stages: dict[str, StageState]
    error: str | None
    started_at: datetime | None
    completed_at: datetime | None
    pipeline_version: int
    prompt_version: int
    retry_count: int
    data_quality: dict | None
    ai_findings: dict | None
    recommendations: dict | None

    model_config = {"from_attributes": True}

    @classmethod
    def from_analysis(cls, analysis: Analysis) -> "AnalysisResponse":
        stages: dict[str, StageState] = {}
        progress = 0

        if analysis.status == AnalysisStatus.READY:
            stages = {s.value: "complete" for s in STAGE_ORDER}
            progress = 100
        elif analysis.status == AnalysisStatus.FAILED:
            # Granular per-stage state isn't reconstructable once terminal -- the error string
            # (prefixed with the failing stage) carries that context instead.
            stages = {}
        else:
            current_index = STAGE_ORDER.index(analysis.status)
            stages = {
                s.value: (
                    "complete"
                    if i < current_index
                    else "processing"
                    if i == current_index
                    else "pending"
                )
                for i, s in enumerate(STAGE_ORDER)
            }
            progress = round(current_index / len(STAGE_ORDER) * 100)

        return cls(
            id=analysis.id,
            dataset_id=analysis.dataset_id,
            dataset_version_id=analysis.dataset_version_id,
            status=analysis.status,
            progress=progress,
            stages=stages,
            error=analysis.error,
            started_at=analysis.started_at,
            completed_at=analysis.completed_at,
            pipeline_version=analysis.pipeline_version,
            prompt_version=analysis.prompt_version,
            retry_count=analysis.retry_count,
            data_quality=analysis.data_quality or None,
            ai_findings=analysis.ai_findings or None,
            recommendations=analysis.recommendations or None,
        )
