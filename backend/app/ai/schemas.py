"""Structured AI output schemas. Every AIProvider response is validated against one of these —
unvalidatable output is rejected, never coerced or executed."""

from enum import StrEnum

from pydantic import BaseModel, Field


class DatasetInterpretation(BaseModel):
    summary: str = Field(max_length=1000)
    likely_domain: str = Field(max_length=200)
    notable_columns: list[str] = Field(max_length=20)
    confidence: float = Field(ge=0.0, le=1.0)


class FindingType(StrEnum):
    RELATIONSHIP = "relationship"
    COMPARISON = "comparison"
    TREND = "trend"
    DISTRIBUTION = "distribution"
    RANKING = "ranking"
    DERIVED_METRIC = "derived_metric"
    OTHER = "other"


class AnalyticalFinding(BaseModel):
    """One analytical observation Gemini surfaces from the dataset summary. This is advisory
    input to the deterministic recommendation engine (app/visualization/recommendation.py) —
    it is never rendered or executed directly, and every `fields` entry is validated against
    the real dataset schema before the finding can influence anything."""

    type: FindingType
    fields: list[str] = Field(max_length=6)
    description: str = Field(max_length=500)
    confidence: float = Field(ge=0.0, le=1.0)
    suggested_chart_type: str | None = Field(default=None, max_length=50)


class AnalyticalFindings(BaseModel):
    findings: list[AnalyticalFinding] = Field(max_length=20)


class Aggregate(StrEnum):
    SUM = "sum"
    MEAN = "mean"
    MEDIAN = "median"
    COUNT = "count"
    MIN = "min"
    MAX = "max"


class ChartRecommendation(BaseModel):
    """One candidate chart proposed by Gemini acting as a senior BI analyst. Every field
    reference is re-validated against the real dataset schema before it can become a
    VisualizationSpec (app/visualization/recommendation.py) -- a hallucinated column name is
    discarded, never fabricated into the response."""

    rank: int = Field(ge=1, le=8)
    chart_type: str = Field(max_length=50)
    title: str = Field(max_length=200)
    description: str = Field(max_length=500)
    reason: str = Field(max_length=500)
    x_field: str | None = None
    y_field: str | None = None
    color_field: str | None = None
    aggregate: Aggregate | None = None
    confidence: float = Field(ge=0.0, le=1.0)


class ChartRecommendations(BaseModel):
    recommendations: list[ChartRecommendation] = Field(max_length=8)


class StudioEditCommandType(StrEnum):
    """Mirrors app.visualization.commands.CommandType -- only the subset a natural-language
    request can unambiguously resolve to. Structural edits (annotations, filters, layout) stay
    manual-studio-only until there's a well-scoped NL grammar for them."""

    CHANGE_CHART_TYPE = "change_chart_type"
    CHANGE_FIELD = "change_field"
    CHANGE_AGGREGATION = "change_aggregation"
    CHANGE_THEME = "change_theme"
    CHANGE_SORT = "change_sort"


class StudioEditCommand(BaseModel):
    """Gemini's translation of one natural-language studio edit request into a single,
    strictly-typed command. Never a full VisualizationSpec -- the deterministic command
    applicator (app/visualization/commands.py) is the only thing that ever mutates a spec, so
    every field here maps onto that applicator's existing, already-validated parameters."""

    command_type: StudioEditCommandType
    chart_type: str | None = Field(default=None, max_length=50)
    channel: str | None = Field(default=None, max_length=20)
    field: str | None = Field(default=None, max_length=200)
    encoding_type: str | None = Field(default=None, max_length=20)
    aggregation: str | None = Field(default=None, max_length=20)
    theme: str | None = Field(default=None, max_length=50)
    sort_descending: bool = False
    explanation: str = Field(max_length=300)
