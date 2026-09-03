"""Deterministic data-quality analysis, run as its own pipeline stage right after ingestion.

Everything here is computed locally against the parsed DataFrame plus the profiler stats already
persisted at ingestion time (app/insights/profiler.py) -- nothing is sent to an LLM and nothing
here mutates the dataset. Findings are advisory (see section 8 of the pipeline spec: never force
destructive cleaning); the existing `CleaningOperation` flow is how a user actually acts on them.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

import polars as pl

_DATE_LIKE_NAME_RE = re.compile(r"(date|_at$|_on$|time)", re.IGNORECASE)
_DATE_VALUE_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}$|^\d{1,2}/\d{1,2}/\d{2,4}$|^\d{1,2}-\d{1,2}-\d{2,4}$"
)

_SEVERITY_PENALTY = {"high": 15, "medium": 8, "low": 3}


@dataclass
class ColumnQualityInput:
    """One column's already-known facts, reused from the profiler instead of recomputed."""

    name: str
    semantic_type: str | None
    raw_type: str
    null_count: int
    unique_count: int
    stats: dict


@dataclass
class DataQualityIssue:
    type: str
    description: str
    severity: str  # "low" | "medium" | "high"
    column: str | None = None


@dataclass
class DataQualityReport:
    score: int
    issues: list[DataQualityIssue] = field(default_factory=list)


def analyze_data_quality(
    df: pl.DataFrame, columns: list[ColumnQualityInput]
) -> DataQualityReport:
    row_count = df.height
    issues: list[DataQualityIssue] = []

    if row_count > 0:
        duplicate_count = int(df.is_duplicated().sum())
        if duplicate_count > 0:
            pct = round(duplicate_count / row_count * 100, 1)
            issues.append(
                DataQualityIssue(
                    type="duplicate_rows",
                    description=f"{duplicate_count} duplicate rows found ({pct}% of the dataset)",
                    severity="high" if pct > 5 else "medium" if pct > 1 else "low",
                )
            )

    for col in columns:
        issues.extend(_column_issues(df, col, row_count))

    score = _score_from_issues(issues)
    return DataQualityReport(score=score, issues=issues)


def _column_issues(
    df: pl.DataFrame, col: ColumnQualityInput, row_count: int
) -> list[DataQualityIssue]:
    issues: list[DataQualityIssue] = []
    if row_count == 0:
        return issues

    null_ratio = col.null_count / row_count

    if col.null_count == row_count:
        issues.append(
            DataQualityIssue(
                type="empty_column",
                column=col.name,
                description=f'"{col.name}" contains no values at all',
                severity="high",
            )
        )
        return issues

    if null_ratio >= 0.02:
        pct = round(null_ratio * 100, 1)
        issues.append(
            DataQualityIssue(
                type="missing_values",
                column=col.name,
                description=f'{pct}% of values in "{col.name}" are missing',
                severity="high" if null_ratio > 0.3 else "medium" if null_ratio > 0.1 else "low",
            )
        )

    if col.unique_count <= 1:
        issues.append(
            DataQualityIssue(
                type="constant_column",
                column=col.name,
                description=f'"{col.name}" has only one distinct value',
                severity="low",
            )
        )

    non_empty_count = row_count - col.null_count

    if col.semantic_type == "categorical" and col.name in df.columns:
        non_null = df[col.name].drop_nulls()
        if len(non_null) > 0:
            normalized_unique = non_null.str.to_lowercase().str.strip_chars().n_unique()
            if normalized_unique < col.unique_count:
                issues.append(
                    DataQualityIssue(
                        type="inconsistent_categories",
                        column=col.name,
                        description=f'"{col.name}" contains inconsistent naming '
                        f"({col.unique_count} raw values, {normalized_unique} after normalizing "
                        "case/whitespace)",
                        severity="medium",
                    )
                )

        if non_empty_count > 20 and col.unique_count / non_empty_count > 0.9:
            issues.append(
                DataQualityIssue(
                    type="high_cardinality",
                    column=col.name,
                    description=f'"{col.name}" has very high cardinality for a categorical '
                    f"field ({col.unique_count} distinct values across {non_empty_count} rows)",
                    severity="low",
                )
            )

    if (
        col.semantic_type in (None, "text", "categorical")
        and col.raw_type == "Utf8"
        and _DATE_LIKE_NAME_RE.search(col.name)
        and col.name in df.columns
    ):
        non_null = df[col.name].drop_nulls()
        sample = non_null.head(200)
        if len(sample) > 0:
            invalid = sum(1 for v in sample if not _DATE_VALUE_RE.match(str(v)))
            invalid_ratio = invalid / len(sample)
            if 0 < invalid_ratio < 1:
                issues.append(
                    DataQualityIssue(
                        type="invalid_dates",
                        column=col.name,
                        description=f'"{col.name}" contains {invalid} values that do not look '
                        "like valid dates",
                        severity="medium" if invalid_ratio > 0.1 else "low",
                    )
                )

    outlier_count = col.stats.get("outliers")
    if isinstance(outlier_count, int) and outlier_count > 0 and non_empty_count > 0:
        ratio = outlier_count / non_empty_count
        if ratio > 0.01:
            issues.append(
                DataQualityIssue(
                    type="outliers",
                    column=col.name,
                    description=f'"{col.name}" has {outlier_count} statistical outliers '
                    f"({round(ratio * 100, 1)}% of values)",
                    severity="low",
                )
            )

    return issues


def _score_from_issues(issues: list[DataQualityIssue]) -> int:
    penalty = sum(_SEVERITY_PENALTY[issue.severity] for issue in issues)
    return max(0, min(100, 100 - penalty))
