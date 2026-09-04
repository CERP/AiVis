"""Builds the minimal, PII-safe payload sent to an AI provider.

Never send raw rows or PII-flagged column contents. The AI only ever sees: schema (name, data
type, cardinality, null percentage) and up to 3 representative sample values per column --
never the full aggregate-stats blob (mean/median/std/skew/outliers/all top values) and never
row-level data. Trimmed deliberately for prompt-size/latency: the full stats blob is still
computed and stored by the profiler for every other consumer, only the AI payload is thinned.
This is the boundary described in AI_ARCHITECTURE.md's data-minimization section.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.insights.data_quality import DataQualityReport
from app.models.insight import Insight
from app.schemas.profile import DatasetProfileResponse

_MAX_SAMPLE_VALUES = 3


def _sample_values(stats: dict) -> list[str]:
    """Distills the profiler's full stats blob into up to 3 representative values --
    top categories for categorical/text columns, min/median/max for numeric, min/max for
    dates -- instead of forwarding the entire aggregate-stats dict to the model."""
    top_values = stats.get("top_values")
    if top_values:
        return [str(v) for v in list(top_values)[:_MAX_SAMPLE_VALUES]]

    numeric_candidates = [stats.get("min"), stats.get("median"), stats.get("max")]
    values = [str(v) for v in numeric_candidates if v is not None]
    return values[:_MAX_SAMPLE_VALUES]


class ColumnSummary(BaseModel):
    name: str
    data_type: str | None
    cardinality: int
    null_percentage: float
    sample_values: list[str] = Field(max_length=_MAX_SAMPLE_VALUES)


class DatasetSummary(BaseModel):
    row_count: int
    column_count: int
    columns: list[ColumnSummary]
    redacted_column_names: list[str]
    """Columns flagged as PII by the profiler — name kept (useful context) but no stats sent."""


def build_dataset_summary(profile: DatasetProfileResponse) -> DatasetSummary:
    columns: list[ColumnSummary] = []
    redacted: list[str] = []

    for col in profile.columns:
        if col.is_pii:
            redacted.append(col.name)
            continue
        null_ratio = col.null_count / profile.row_count if profile.row_count > 0 else 0.0
        columns.append(
            ColumnSummary(
                name=col.name,
                data_type=col.semantic_type,
                cardinality=col.unique_count,
                null_percentage=round(null_ratio * 100, 2),
                sample_values=_sample_values(col.stats),
            )
        )

    return DatasetSummary(
        row_count=profile.row_count,
        column_count=profile.column_count,
        columns=columns,
        redacted_column_names=redacted,
    )


class QualityIssueSummary(BaseModel):
    type: str
    column: str | None
    description: str
    severity: str


class DetectedRelationship(BaseModel):
    """A statistically-detected insight (app/insights/engine.py), already grounded in real
    computation -- passed to Gemini as a hint, never invented by the model itself."""

    type: str
    fields: list[str]
    confidence: float


class AnalysisContext(BaseModel):
    """The full AI-safe payload for the AnalyticalFindings prompt: the same dataset summary
    used for semantic interpretation, plus data-quality findings and already-detected
    statistical relationships/dimensions -- so Gemini reasons from real signals instead of
    re-deriving (and possibly hallucinating) them from scratch."""

    dataset: DatasetSummary
    data_quality_score: int
    data_quality_issues: list[QualityIssueSummary]
    detected_relationships: list[DetectedRelationship]
    time_dimensions: list[str]
    geographic_dimensions: list[str]


def build_analysis_context(
    profile: DatasetProfileResponse,
    data_quality: DataQualityReport,
    insights: list[Insight],
) -> AnalysisContext:
    dataset = build_dataset_summary(profile)

    time_dimensions = [
        c.name for c in profile.columns if c.semantic_type == "date" and not c.is_pii
    ]
    geographic_dimensions = [
        c.name for c in profile.columns if c.semantic_type == "geographic" and not c.is_pii
    ]

    return AnalysisContext(
        dataset=dataset,
        data_quality_score=data_quality.score,
        data_quality_issues=[
            QualityIssueSummary(
                type=i.type, column=i.column, description=i.description, severity=i.severity
            )
            for i in data_quality.issues
        ],
        detected_relationships=[
            DetectedRelationship(type=i.type.value, fields=i.fields, confidence=i.confidence)
            for i in insights
        ],
        time_dimensions=time_dimensions,
        geographic_dimensions=geographic_dimensions,
    )
