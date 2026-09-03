"""Backend chart-type registry -- the full 41-type visualization library, mirroring
`frontend/src/lib/visualization/registry.ts` exactly (same ids, same `implemented` flags). This
is the compatibility-engine source of truth: `validate_spec()` uses it to reject unknown or
unimplemented chart types, and the recommendation engine uses `IMPLEMENTED_CHART_TYPES` to
decide what Gemini/deterministic detectors are even allowed to suggest.

All 42 entries (the 41 required types plus `grouped_bar`) are implemented: Vega-Lite for the
mark/layer/transform-expressible ones, D3 for layout-dependent ones (hierarchy, force, chord,
sankey, geo projections), and React components for KPI/table/matrix. See
`aivis-visualization-library-verification.md` for the per-type renderer and evidence.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ChartDefinition:
    id: str
    category: str
    required_semantic_types: tuple[str, ...]
    """Semantic types (profiler vocabulary: numeric/currency/categorical/date/geographic/text/
    identifier/boolean) this chart type's required encodings need to be compatible with -- used
    only as a coarse compatibility signal, not a strict per-encoding contract (that's still
    `validate_spec`'s per-encoding job)."""
    requires_temporal: bool = False
    requires_geographic: bool = False
    requires_hierarchical: bool = False
    requires_relational: bool = False
    requires_ohlc: bool = False
    implemented: bool = False


def _c(id_: str, category: str, *semantic_types: str, **kwargs: object) -> ChartDefinition:
    return ChartDefinition(
        id=id_, category=category, required_semantic_types=semantic_types, **kwargs  # type: ignore[arg-type]
    )


# ids map to the original 41-item list's name where they differ: bar="Column Chart" (#1),
# stacked_bar="Stacked Column Chart" (#2), horizontal_bar="Bar Chart" (#3),
# stacked_bar_horizontal="Stacked Bar Chart" (#18).
CHART_DEFINITIONS: tuple[ChartDefinition, ...] = (
    _c("bar", "comparison", "categorical", "numeric", implemented=True),
    _c("stacked_bar", "comparison", "categorical", "numeric", implemented=True),
    _c("horizontal_bar", "comparison", "categorical", "numeric", implemented=True),
    _c("stacked_bar_horizontal", "comparison", "categorical", "numeric", implemented=True),
    _c("grouped_bar", "comparison", "categorical", "numeric", implemented=True),
    _c("sorted_bar", "comparison", "categorical", "numeric", implemented=True),
    _c("lollipop", "comparison", "categorical", "numeric", implemented=True),
    _c("radar", "comparison", "categorical", "numeric", implemented=True),
    _c("bullet", "comparison", "numeric", implemented=True),
    _c("line", "temporal", "date", "numeric", requires_temporal=True, implemented=True),
    _c("area", "temporal", "date", "numeric", requires_temporal=True, implemented=True),
    _c("sparkline", "temporal", "date", "numeric", requires_temporal=True, implemented=True),
    _c(
        "candlestick", "temporal", "date",
        requires_temporal=True, requires_ohlc=True, implemented=True,
    ),
    _c("ohlc", "temporal", "date", requires_temporal=True, requires_ohlc=True, implemented=True),
    _c(
        "ribbon", "temporal", "date", "categorical", "numeric",
        requires_temporal=True, implemented=True,
    ),
    _c(
        "bump", "temporal", "date", "categorical", "numeric",
        requires_temporal=True, implemented=True,
    ),
    _c("line_column", "comparison", "categorical", "date", "numeric", implemented=True),
    _c("pie", "part_to_whole", "categorical", "numeric", implemented=True),
    _c("donut", "part_to_whole", "categorical", "numeric", implemented=True),
    _c(
        "treemap", "hierarchical", "categorical", "numeric",
        requires_hierarchical=True, implemented=True,
    ),
    _c(
        "sunburst", "hierarchical", "categorical", "numeric",
        requires_hierarchical=True, implemented=True,
    ),
    _c("waterfall", "part_to_whole", "categorical", "numeric", implemented=True),
    _c("histogram", "distribution", "numeric", implemented=True),
    _c("box_plot", "distribution", "categorical", "numeric", implemented=True),
    _c("violin", "distribution", "categorical", "numeric", implemented=True),
    _c("marimekko", "distribution", "categorical", "numeric", implemented=True),
    _c("scatter", "relationship", "numeric", implemented=True),
    _c("bubble", "relationship", "numeric", implemented=True),
    _c("heatmap", "relationship", "categorical", "numeric", implemented=True),
    _c("network", "relationship", "categorical", requires_relational=True, implemented=True),
    _c(
        "chord", "relationship", "categorical", "numeric",
        requires_relational=True, implemented=True,
    ),
    _c("funnel", "flow", "categorical", "numeric", implemented=True),
    _c("gantt", "flow", "date", "categorical", requires_temporal=True, implemented=True),
    _c("sankey", "flow", "categorical", "numeric", requires_relational=True, implemented=True),
    _c(
        "decomposition_tree", "hierarchical", "categorical", "numeric",
        requires_hierarchical=True, implemented=True,
    ),
    _c(
        "choropleth", "geographic", "geographic", "numeric",
        requires_geographic=True, implemented=True,
    ),
    _c(
        "bubble_map", "geographic", "geographic", "numeric",
        requires_geographic=True, implemented=True,
    ),
    _c(
        "flow_map", "geographic", "geographic", "numeric",
        requires_geographic=True, requires_relational=True, implemented=True),
    _c("kpi", "single_metric", "numeric", implemented=True),
    _c("gauge", "single_metric", "numeric", implemented=True),
    _c("table", "raw_data", implemented=True),
    _c("matrix", "raw_data", "categorical", "numeric", implemented=True),
)

CHART_DEFINITIONS_BY_ID: dict[str, ChartDefinition] = {c.id: c for c in CHART_DEFINITIONS}

ALL_KNOWN_CHART_TYPES: frozenset[str] = frozenset(CHART_DEFINITIONS_BY_ID)
IMPLEMENTED_CHART_TYPES: frozenset[str] = frozenset(
    c.id for c in CHART_DEFINITIONS if c.implemented
)
PLANNED_CHART_TYPES: frozenset[str] = ALL_KNOWN_CHART_TYPES - IMPLEMENTED_CHART_TYPES
