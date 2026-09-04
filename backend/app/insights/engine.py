"""Decides which detectors are applicable to a dataset's columns and runs them. Never asks
an LLM "what insights are there" -- candidates come only from real statistical detectors
(app/insights/detectors.py) run against actual column semantic types.
"""

from __future__ import annotations

import itertools

import polars as pl

from app.insights.detectors import (
    InsightCandidate,
    detect_composition,
    detect_distribution,
    detect_flow,
    detect_hierarchy,
    detect_outliers,
    detect_ranking,
    detect_relationship,
    detect_trend,
    looks_like_flow_pair,
)

_MAX_CATEGORICAL_CARDINALITY_FOR_RANKING = 50
_MAX_NUMERIC_PAIRS_CHECKED = 15
_MAX_CATEGORICAL_PAIRS_CHECKED = 10


def generate_insights(
    df: pl.DataFrame, column_semantic_types: dict[str, str]
) -> list[InsightCandidate]:
    candidates: list[InsightCandidate] = []

    date_cols = [c for c, t in column_semantic_types.items() if t == "date"]
    numeric_cols = [c for c, t in column_semantic_types.items() if t in ("numeric", "currency")]
    # "categorical" + "geographic", not just "categorical" -- a column named "region"/
    # "country"/"city" classifies as geographic (profiler.py's name-hint heuristic), not
    # categorical, but is exactly as valid a grouping dimension for ranking (and composition/
    # hierarchy below). Found live: a region+revenue dataset produced zero ranking insight --
    # and so no bar/donut/pie recommendation -- until "region" was included here too.
    nominal_types = ("categorical", "geographic")
    nominal_cols = [c for c, t in column_semantic_types.items() if t in nominal_types]

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

    for category_col, value_col in itertools.product(nominal_cols, numeric_cols):
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

    # --- Multi-field detectors: feed the chart types that need 3 encodings (stacked_bar,
    # heatmap, marimekko, treemap, sunburst, sankey, network, chord) so they can be
    # auto-recommended instead of studio-only. See recommendation.py's 3-field branch. ---
    categorical_pairs = list(itertools.combinations(nominal_cols, 2))[
        :_MAX_CATEGORICAL_PAIRS_CHECKED
    ]
    for (cat_a, cat_b), value_col in itertools.product(categorical_pairs, numeric_cols):
        hierarchy_insight = detect_hierarchy(df, cat_a, cat_b, value_col)
        if hierarchy_insight:
            candidates.append(hierarchy_insight)
            continue  # a genuine hierarchy isn't also reported as a flat composition

        composition_insight = detect_composition(df, cat_a, cat_b, value_col)
        if composition_insight:
            candidates.append(composition_insight)

    for cat_a, cat_b in categorical_pairs:
        flow_pair = looks_like_flow_pair(cat_a, cat_b)
        if flow_pair is None:
            continue
        source_col, target_col = flow_pair
        for value_col in numeric_cols:
            flow_insight = detect_flow(df, source_col, target_col, value_col)
            if flow_insight:
                candidates.append(flow_insight)

    return candidates
