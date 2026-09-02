"""Decides which detectors are applicable to a dataset's columns and runs them. Never asks
an LLM "what insights are there" -- candidates come only from real statistical detectors
(app/insights/detectors.py) run against actual column semantic types.
"""

from __future__ import annotations

import itertools

import polars as pl

from app.insights.detectors import (
    InsightCandidate,
    detect_distribution,
    detect_outliers,
    detect_ranking,
    detect_relationship,
    detect_trend,
)

_MAX_CATEGORICAL_CARDINALITY_FOR_RANKING = 50
_MAX_NUMERIC_PAIRS_CHECKED = 15


def generate_insights(
    df: pl.DataFrame, column_semantic_types: dict[str, str]
) -> list[InsightCandidate]:
    candidates: list[InsightCandidate] = []

    date_cols = [c for c, t in column_semantic_types.items() if t == "date"]
    numeric_cols = [c for c, t in column_semantic_types.items() if t in ("numeric", "currency")]
    categorical_cols = [c for c, t in column_semantic_types.items() if t == "categorical"]

    for value_col in numeric_cols:
        outlier_insight = detect_outliers(df, value_col)
        if outlier_insight:
            candidates.append(outlier_insight)

        distribution_insight = detect_distribution(df, value_col)
        if distribution_insight:
            candidates.append(distribution_insight)

    for date_col, value_col in itertools.product(date_cols, numeric_cols):
        trend_insight = detect_trend(df, date_col, value_col)
        if trend_insight:
            candidates.append(trend_insight)

    for category_col, value_col in itertools.product(categorical_cols, numeric_cols):
        ranking_insight = detect_ranking(
            df, category_col, value_col, max_categories=_MAX_CATEGORICAL_CARDINALITY_FOR_RANKING
        )
        if ranking_insight:
            candidates.append(ranking_insight)

    numeric_pairs = list(itertools.combinations(numeric_cols, 2))[:_MAX_NUMERIC_PAIRS_CHECKED]
    for col_a, col_b in numeric_pairs:
        relationship_insight = detect_relationship(df, col_a, col_b)
        if relationship_insight:
            candidates.append(relationship_insight)

    return candidates
