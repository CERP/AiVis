"""The canonical VisualizationSpec. This is the single source of truth for a chart's state --
everything downstream (validation, renderers, the studio, and eventually the Phase 2 AI
copilot) reads and writes this shape, never ad-hoc chart config. It is JSON-serializable so it
can be stored verbatim in VisualizationVersion.spec and diffed across versions.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class EncodingType(StrEnum):
    QUANTITATIVE = "quantitative"
    ORDINAL = "ordinal"
    NOMINAL = "nominal"
    TEMPORAL = "temporal"


class Aggregation(StrEnum):
    NONE = "none"
    SUM = "sum"
    MEAN = "mean"
    MEDIAN = "median"
    COUNT = "count"
    MIN = "min"
    MAX = "max"


class Encoding(BaseModel):
    field: str
    type: EncodingType
    aggregation: Aggregation = Aggregation.NONE
    label: str | None = None
    format: str | None = None
    """Number/date format string, e.g. '.1%' or '%b %Y' -- rendering hint only."""


class Encodings(BaseModel):
    x: Encoding | None = None
    y: Encoding | None = None
    color: Encoding | None = None
    size: Encoding | None = None
    detail: Encoding | None = None
    """Extra grouping field with no visual channel of its own (e.g. facet key)."""

    # --- Range / interval channels ---
    x2: Encoding | None = None
    """End of an x-range. Required by Gantt (task start -> end); the bar spans x..x2."""
    y2: Encoding | None = None
    """End of a y-range (e.g. an explicit band). Set automatically by the waterfall compiler."""

    # --- Second measure (dual-axis combination charts) ---
    measure2: Encoding | None = None
    """A second, independently-scaled measure. Used by line_column: `y` renders as columns,
    `measure2` as an overlaid line on its own axis."""

    # --- Financial OHLC channels ---
    open: Encoding | None = None
    high: Encoding | None = None
    low: Encoding | None = None
    close: Encoding | None = None
    """Open/high/low/close for candlestick and OHLC charts. All four are required together;
    `x` carries the period. Validated as a set, never partially."""


class FilterOperator(StrEnum):
    EQ = "eq"
    NEQ = "neq"
    GT = "gt"
    GTE = "gte"
    LT = "lt"
    LTE = "lte"
    IN = "in"
    NOT_NULL = "not_null"


class Filter(BaseModel):
    id: str
    field: str
    operator: FilterOperator
    value: str | float | list[str] | list[float] | None = None


class SortSpec(BaseModel):
    field: str
    descending: bool = False


class AnnotationType(StrEnum):
    CALLOUT = "callout"
    REFERENCE_LINE = "reference_line"
    HIGHLIGHTED_REGION = "highlighted_region"
    LABEL = "label"
    SOURCE_NOTE = "source_note"


class Annotation(BaseModel):
    id: str
    type: AnnotationType
    text: str
    target_field: str | None = None
    target_value: str | float | None = None
    """What the annotation points at, e.g. a specific x-value for a reference_line."""


class Typography(BaseModel):
    title: str | None = None
    subtitle: str | None = None
    source_note: str | None = None


class Layout(BaseModel):
    width: int | None = None
    height: int | None = None
    show_legend: bool = True
    show_grid: bool = True


class VisualizationMetadata(BaseModel):
    dataset_id: str
    dataset_version_id: str
    story_id: str | None = None
    generated_by: str = "deterministic"
    """Provenance: 'deterministic' (Story pipeline, no LLM), 'gemini' (AI-proposed chart, every
    field still re-validated against the real schema before this spec exists), or 'user' (manual
    studio edit)."""
    reasoning: str | None = None
    """Gemini's own one-sentence justification for this chart/field pairing, when
    generated_by='gemini' -- never shown as a claim of fact, just the model's stated reasoning."""


class VisualizationSpec(BaseModel):
    """Versioned, validated, renderer-agnostic. Never contains executable code -- only
    declarative field/encoding/style references the renderer interprets."""

    chart_type: str
    encoding: Encodings = Field(default_factory=Encodings)
    transformations: list[str] = Field(default_factory=list)
    """Named transform references (e.g. 'coerce_numeric:revenue') applied before rendering --
    not arbitrary code."""
    filters: list[Filter] = Field(default_factory=list)
    sort: SortSpec | None = None
    annotations: list[Annotation] = Field(default_factory=list)
    theme: str = "minimal"
    typography: Typography = Field(default_factory=Typography)
    layout: Layout = Field(default_factory=Layout)
    metadata: VisualizationMetadata
