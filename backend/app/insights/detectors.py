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
_MIN_CELLS_FOR_COMPOSITION = 4
_MAX_CATEGORICAL_CARDINALITY_FOR_MULTIFIELD = 20

# Column-name hints for directed source/target pairs -- same heuristic-by-name pattern already
# used for PII (profiler.py::_PII_NAME_HINTS) and geographic (profiler.py::_GEO_NAME_HINTS)
# detection. There is no semantic type for "this pair of columns represents a directed edge",
# so name hints are the only deterministic signal available short of asking an LLM to guess.
_SOURCE_NAME_HINTS = {"source", "from", "origin", "sender", "referrer", "start"}
_TARGET_NAME_HINTS = {"target", "to", "destination", "dest", "receiver", "end"}


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


def detect_composition(
    df: pl.DataFrame, category_a: str, category_b: str, value_col: str
) -> InsightCandidate | None:
    """Two categorical dimensions cross-cut by one numeric measure -- e.g. revenue by region and
    product. Feeds stacked_bar/heatmap/marimekko, which all need exactly this shape (two
    dimensions + one measure). Only fires when both dimensions have a workable cardinality and
    the cross-tab actually has more than one populated cell -- a 1x1 or 1xN cross-tab isn't a
    genuine composition, it's a plain ranking (already covered by detect_ranking)."""
    subset = df.select([category_a, category_b, value_col]).drop_nulls()
    if subset.height == 0:
        return None

    n_a = subset[category_a].n_unique()
    n_b = subset[category_b].n_unique()
    if n_a < 2 or n_b < 2:
        return None
    max_cardinality = _MAX_CATEGORICAL_CARDINALITY_FOR_MULTIFIELD
    if n_a > max_cardinality or n_b > max_cardinality:
        return None

    grouped = subset.group_by([category_a, category_b]).agg(pl.col(value_col).sum().alias("total"))
    if grouped.height < _MIN_CELLS_FOR_COMPOSITION:
        return None

    top = grouped.sort("total", descending=True).row(0, named=True)
    grand_total = grouped["total"].sum()
    top_share = (top["total"] / grand_total * 100) if grand_total else 0

    return InsightCandidate(
        type="composition",
        title=(
            f"{value_col.replace('_', ' ').title()} breaks down across "
            f"{category_a.replace('_', ' ')} and {category_b.replace('_', ' ')}"
        ),
        description=(
            f"{n_a} {category_a.replace('_', ' ')} values x {n_b} {category_b.replace('_', ' ')} "
            f"values compose {value_col.replace('_', ' ')} -- the largest single combination is "
            f"{top[category_a]} / {top[category_b]} at {top['total']:.2f} "
            f"({top_share:.1f}% of the total)."
        ),
        fields=[category_a, category_b, value_col],
        calculation={
            "metric": "cross_tab_sum",
            "cells_populated": grouped.height,
            "top_combination": [top[category_a], top[category_b]],
            "top_value": top["total"],
            "top_share_pct": round(top_share, 2),
        },
        confidence=0.7,
    )


def detect_hierarchy(
    df: pl.DataFrame, outer_col: str, inner_col: str, value_col: str
) -> InsightCandidate | None:
    """A genuinely nested categorical grouping -- e.g. department -> category -- rather than two
    independent dimensions. Verified deterministically: an inner value must belong to exactly one
    outer value for the vast majority of cases (>=80%), otherwise the pair is a composition, not
    a hierarchy, and detect_composition already covers that shape. Feeds treemap/sunburst/
    decomposition_tree."""
    subset = df.select([outer_col, inner_col, value_col]).drop_nulls()
    if subset.height == 0:
        return None

    n_outer = subset[outer_col].n_unique()
    n_inner = subset[inner_col].n_unique()
    if n_outer < 2 or n_inner < 2:
        return None
    max_cardinality = _MAX_CATEGORICAL_CARDINALITY_FOR_MULTIFIELD
    if n_outer > max_cardinality or n_inner > max_cardinality:
        return None

    pairs = subset.select([outer_col, inner_col]).unique()
    outer_counts_per_inner = pairs.group_by(inner_col).agg(
        pl.col(outer_col).n_unique().alias("n_outer")
    )
    nested_ratio = (outer_counts_per_inner["n_outer"] == 1).sum() / outer_counts_per_inner.height
    if nested_ratio < 0.8:
        return None

    grouped = subset.group_by(outer_col).agg(pl.col(value_col).sum().alias("total")).sort(
        "total", descending=True
    )
    top = grouped.row(0, named=True)
    grand_total = grouped["total"].sum()
    top_share = (top["total"] / grand_total * 100) if grand_total else 0

    return InsightCandidate(
        type="hierarchy",
        title=(
            f"{value_col.replace('_', ' ').title()} breaks down by "
            f"{outer_col.replace('_', ' ')} and {inner_col.replace('_', ' ')}"
        ),
        description=(
            f"{n_inner} {inner_col.replace('_', ' ')} values nest within {n_outer} "
            f"{outer_col.replace('_', ' ')} values. {top[outer_col]} leads with "
            f"{top['total']:.2f} ({top_share:.1f}% of the total {value_col.replace('_', ' ')})."
        ),
        fields=[outer_col, inner_col, value_col],
        calculation={
            "metric": "nested_group_sum",
            "nested_ratio": round(nested_ratio, 3),
            "top_outer": top[outer_col],
            "top_value": top["total"],
            "top_share_pct": round(top_share, 2),
        },
        confidence=0.7,
    )


def looks_like_flow_pair(name_a: str, name_b: str) -> tuple[str, str] | None:
    """Returns (source_col, target_col) if the pair's names suggest a directed edge, else None.
    Name-hint heuristic, same pattern as PII/geographic detection in profiler.py -- there is no
    semantic type for "directed relationship," so column naming is the only deterministic signal
    available without asking an LLM to guess at the data's meaning."""
    a, b = name_a.lower(), name_b.lower()
    a_is_source = any(hint in a for hint in _SOURCE_NAME_HINTS)
    b_is_target = any(hint in b for hint in _TARGET_NAME_HINTS)
    if a_is_source and b_is_target:
        return name_a, name_b
    b_is_source = any(hint in b for hint in _SOURCE_NAME_HINTS)
    a_is_target = any(hint in a for hint in _TARGET_NAME_HINTS)
    if b_is_source and a_is_target:
        return name_b, name_a
    return None


def detect_flow(
    df: pl.DataFrame, source_col: str, target_col: str, value_col: str
) -> InsightCandidate | None:
    """A directed source -> target relationship with a numeric weight -- e.g. traffic source ->
    landing page, with session count. Feeds sankey/network/chord. Only called for column pairs
    that `looks_like_flow_pair` already identified by name, so this function's job is purely the
    statistical side: is there enough real flow structure to be worth visualizing."""
    subset = df.select([source_col, target_col, value_col]).drop_nulls()
    if subset.height == 0:
        return None

    n_edges = subset.select([source_col, target_col]).unique().height
    if n_edges < 2:
        return None

    grouped = subset.group_by([source_col, target_col]).agg(pl.col(value_col).sum().alias("total"))
    top = grouped.sort("total", descending=True).row(0, named=True)
    grand_total = grouped["total"].sum()
    top_share = (top["total"] / grand_total * 100) if grand_total else 0

    return InsightCandidate(
        type="flow",
        title=f"{source_col.replace('_', ' ').title()} flows into {target_col.replace('_', ' ')}",
        description=(
            f"{n_edges} distinct {source_col.replace('_', ' ')} → {target_col.replace('_', ' ')} "
            f"flows found. The strongest is {top[source_col]} → {top[target_col]} at "
            f"{top['total']:.2f} ({top_share:.1f}% of total {value_col.replace('_', ' ')})."
        ),
        fields=[source_col, target_col, value_col],
        calculation={
            "metric": "directed_edge_sum",
            "edge_count": n_edges,
            "top_edge": [top[source_col], top[target_col]],
            "top_value": top["total"],
            "top_share_pct": round(top_share, 2),
        },
        confidence=0.65,
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
