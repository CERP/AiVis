"""Structured AI output schemas. Every AIProvider response is validated against one of these —
unvalidatable output is rejected, never coerced or executed."""

from pydantic import BaseModel, Field


class DatasetInterpretation(BaseModel):
    summary: str = Field(max_length=1000)
    likely_domain: str = Field(max_length=200)
    notable_columns: list[str] = Field(max_length=20)
    confidence: float = Field(ge=0.0, le=1.0)
