import uuid
from enum import StrEnum

from sqlmodel import JSON, Column, Field, Relationship

from app.models.base import TimestampedModel


class InsightType(StrEnum):
    TREND = "trend"
    CHANGE = "change"
    OUTLIER = "outlier"
    RELATIONSHIP = "relationship"
    RANKING = "ranking"
    DISTRIBUTION = "distribution"
    SEASONALITY = "seasonality"
    ANOMALY = "anomaly"
    COMPOSITION = "composition"
    """Two categorical dimensions cross-cut by one numeric measure -- feeds stacked_bar,
    heatmap, marimekko."""
    HIERARCHY = "hierarchy"
    """A nested categorical grouping (outer level -> inner level) with a numeric measure --
    feeds treemap, sunburst, decomposition_tree."""
    FLOW = "flow"
    """A directed source -> target relationship with a numeric weight -- feeds sankey,
    network, chord."""


class Insight(TimestampedModel, table=True):
    __tablename__ = "insights"

    dataset_version_id: uuid.UUID = Field(foreign_key="dataset_versions.id", index=True)
    type: InsightType
    title: str = Field(max_length=500)
    description: str = Field(max_length=2000)
    fields: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    """Column names this insight is derived from — provenance, never hallucinated."""
    calculation: dict = Field(default_factory=dict, sa_column=Column(JSON))
    """Computed values/method backing the insight, e.g. {"metric": "sum", "delta_pct": 31.2}."""
    confidence: float = Field(default=1.0)

    stories: list["Story"] = Relationship(back_populates="insight")


class Story(TimestampedModel, table=True):
    __tablename__ = "stories"

    dataset_version_id: uuid.UUID = Field(foreign_key="dataset_versions.id", index=True)
    insight_id: uuid.UUID | None = Field(default=None, foreign_key="insights.id")
    title: str = Field(max_length=500)
    description: str = Field(max_length=2000)
    analytical_question: str = Field(max_length=500)
    relevant_fields: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    recommended_chart_type: str | None = Field(default=None, max_length=100)
    confidence: float = Field(default=1.0)

    insight: Insight | None = Relationship(back_populates="stories")
