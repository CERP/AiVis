"""Builds the minimal, PII-safe payload sent to an AI provider.

Never send raw rows or PII-flagged column contents. The AI only ever sees: schema (names +
semantic types), aggregate statistics, and categorical top-value labels — never row-level data.
This is the boundary described in AI_ARCHITECTURE.md's data-minimization section.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.profile import DatasetProfileResponse


class ColumnSummary(BaseModel):
    name: str
    semantic_type: str | None
    null_ratio: float
    unique_count: int
    stats: dict


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
                semantic_type=col.semantic_type,
                null_ratio=round(null_ratio, 4),
                unique_count=col.unique_count,
                stats=col.stats,
            )
        )

    return DatasetSummary(
        row_count=profile.row_count,
        column_count=profile.column_count,
        columns=columns,
        redacted_column_names=redacted,
    )
