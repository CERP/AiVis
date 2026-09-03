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
