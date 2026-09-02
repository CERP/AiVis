"""Deterministic insight detectors. Every insight must be traceable to an actual calculation
over real data -- never a hallucinated conclusion. Each detector returns InsightCandidate
objects carrying the exact fields and computed values that produced them (Insight.fields /
Insight.calculation), so the provenance survives into the persisted row.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import polars as pl

_CORRELATION_THRESHOLD = 0.5
_MIN_ROWS_FOR_TREND = 3


@dataclass
class InsightCandidate:
    type: str
    title: str
    description: str
    fields: list[str]
    calculation: dict = field(default_factory=dict)
    confidence: float = 1.0


def detect_trend(df: pl.DataFrame, date_col: str, value_col: str) -> InsightCandidate | None:
    subset = df.select([date_col, value_col]).drop_nulls().sort(date_col)
    if subset.height < _MIN_ROWS_FOR_TREND:
        return None

    first_value = subset[value_col][0]
    last_value = subset[value_col][-1]
    if first_value in (None, 0):
        return None

    delta_pct = ((last_value - first_value) / abs(first_value)) * 100
    direction = "increased" if delta_pct >= 0 else "decreased"

    return InsightCandidate(
        type="trend",
        title=f"{value_col.replace('_', ' ').title()} {direction} {abs(delta_pct):.1f}%",
        description=(
            f"{value_col.replace('_', ' ').title()} {direction} from {first_value:.2f} to "
            f"{last_value:.2f} ({abs(delta_pct):.1f}%) across the observed period."
        ),
        fields=[date_col, value_col],
        calculation={
            "metric": "pct_change_first_to_last",
            "first_value": first_value,
            "last_value": last_value,
            "delta_pct": round(delta_pct, 2),
        },
        confidence=0.9 if subset.height >= 10 else 0.7,
    )


def detect_ranking(
    df: pl.DataFrame, category_col: str, value_col: str, *, max_categories: int = 50
) -> InsightCandidate | None:
    subset = df.select([category_col, value_col]).drop_nulls()
    if subset.height == 0:
        return None
    n_categories = subset[category_col].n_unique()
    if n_categories < 2 or n_categories > max_categories:
        return None

    grouped = (
        subset.group_by(category_col)
        .agg(pl.col(value_col).sum().alias("total"))
        .sort("total", descending=True)
    )
    top_row = grouped.row(0, named=True)
    total_sum = grouped["total"].sum()
    share_pct = (top_row["total"] / total_sum * 100) if total_sum else 0

    return InsightCandidate(
        type="ranking",
        title=f"{top_row[category_col]} leads on {value_col.replace('_', ' ')}",
        description=(
            f"{top_row[category_col]} has the highest total {value_col.replace('_', ' ')} "
            f"({top_row['total']:.2f}, {share_pct:.1f}% of the total across "
            f"{n_categories} categories)."
        ),
        fields=[category_col, value_col],
        calculation={
            "metric": "sum_by_category",
            "top_category": top_row[category_col],
            "top_value": top_row["total"],
            "share_pct": round(share_pct, 2),
        },
        confidence=0.85,
    )


def detect_outliers(df: pl.DataFrame, value_col: str) -> InsightCandidate | None:
    series = df[value_col].drop_nulls()
    if series.len() < 4:
        return None

    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    if q1 is None or q3 is None:
        return None
    iqr = q3 - q1
    if iqr == 0:
        return None

    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    outlier_mask = (series < lower_bound) | (series > upper_bound)
    outlier_count = int(outlier_mask.sum())
    if outlier_count == 0:
        return None

    outlier_values = series.filter(outlier_mask).to_list()
    return InsightCandidate(
        type="outlier",
        title=f"{outlier_count} outlier(s) in {value_col.replace('_', ' ')}",
        description=(
            f"{outlier_count} value(s) in {value_col.replace('_', ' ')} fall outside the "
            f"expected range ({lower_bound:.2f} to {upper_bound:.2f})."
        ),
        fields=[value_col],
        calculation={
            "metric": "iqr_outliers",
            "lower_bound": round(lower_bound, 2),
            "upper_bound": round(upper_bound, 2),
            "outlier_values": outlier_values[:10],
        },
        confidence=0.8,
    )


def detect_relationship(
    df: pl.DataFrame, col_a: str, col_b: str
) -> InsightCandidate | None:
    subset = df.select([col_a, col_b]).drop_nulls()
    if subset.height < 4:
        return None

    corr = subset.select(pl.corr(col_a, col_b)).item()
    if corr is None or abs(corr) < _CORRELATION_THRESHOLD:
        return None

    strength = "strong" if abs(corr) >= 0.7 else "moderate"
    direction = "positive" if corr > 0 else "negative"

    return InsightCandidate(
        type="relationship",
        title=f"{strength.title()} {direction} relationship between "
        f"{col_a.replace('_', ' ')} and {col_b.replace('_', ' ')}",
        description=(
            f"{col_a.replace('_', ' ').title()} and {col_b.replace('_', ' ')} show a "
            f"{strength} {direction} relationship (r={corr:.2f})."
        ),
        fields=[col_a, col_b],
        calculation={"metric": "pearson_correlation", "r": round(corr, 3)},
        confidence=min(0.95, abs(corr)),
    )


def detect_distribution(df: pl.DataFrame, value_col: str) -> InsightCandidate | None:
    series = df[value_col].drop_nulls()
    if series.len() < 4:
        return None

    q1 = series.quantile(0.25)
    q3 = series.quantile(0.75)
    if q1 is None or q3 is None:
        return None

    return InsightCandidate(
        type="distribution",
        title=f"Most {value_col.replace('_', ' ')} values fall between {q1:.2f} and {q3:.2f}",
        description=(
            f"The middle 50% of {value_col.replace('_', ' ')} observations fall between "
            f"{q1:.2f} and {q3:.2f} (median {series.median():.2f})."
        ),
        fields=[value_col],
        calculation={
            "metric": "interquartile_range",
            "q1": round(q1, 2),
            "q3": round(q3, 2),
            "median": round(series.median(), 2),
        },
        confidence=0.75,
    )
