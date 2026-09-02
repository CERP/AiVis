import uuid

from sqlmodel import JSON, Column, Field, Relationship

from app.models.base import TimestampedModel


class Theme(TimestampedModel, table=True):
    __tablename__ = "themes"

    name: str = Field(max_length=200, unique=True)
    description: str | None = Field(default=None, max_length=1000)
    tokens: dict = Field(default_factory=dict, sa_column=Column(JSON))
    """Colors, typography, spacing, grid, annotations, axes, labels,
    background, borders, emphasis tokens."""


class Visualization(TimestampedModel, table=True):
    __tablename__ = "visualizations"

    project_id: uuid.UUID = Field(foreign_key="projects.id", index=True)
    dataset_version_id: uuid.UUID = Field(foreign_key="dataset_versions.id", index=True)
    story_id: uuid.UUID | None = Field(default=None, foreign_key="stories.id")
    title: str = Field(max_length=300)
    current_version_id: uuid.UUID | None = Field(default=None)

    versions: list["VisualizationVersion"] = Relationship(back_populates="visualization")


class VisualizationVersion(TimestampedModel, table=True):
    """Immutable snapshot of a VisualizationSpec. Every studio/AI mutation creates a new row."""

    __tablename__ = "visualization_versions"

    visualization_id: uuid.UUID = Field(foreign_key="visualizations.id", index=True)
    version_number: int
    spec: dict = Field(default_factory=dict, sa_column=Column(JSON))
    """Canonical VisualizationSpec (chartType, encodings, transforms, theme, annotations, ...)."""
    change_summary: str | None = Field(default=None, max_length=500)
    created_by: str = Field(default="user", max_length=50)
    """'user' (manual edit) | 'system' (recommendation engine) — no 'ai_chat' yet (Phase 2)."""

    visualization: Visualization = Relationship(back_populates="versions")
