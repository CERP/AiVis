import uuid
from enum import StrEnum

from sqlmodel import JSON, Column, Field, Relationship

from app.models.base import TimestampedModel


class DatasetStatus(StrEnum):
    UPLOADING = "uploading"
    INGESTING = "ingesting"
    PROFILING = "profiling"
    READY = "ready"
    FAILED = "failed"


class Dataset(TimestampedModel, table=True):
    __tablename__ = "datasets"

    project_id: uuid.UUID = Field(foreign_key="projects.id", index=True)
    name: str = Field(max_length=300)
    original_filename: str = Field(max_length=500)
    mime_type: str = Field(max_length=200)
    size_bytes: int = Field(default=0)
    status: DatasetStatus = Field(default=DatasetStatus.UPLOADING)
    raw_object_key: str = Field(max_length=1000)
    error_message: str | None = Field(default=None, max_length=2000)

    project: "Project" = Relationship(back_populates="datasets")  # noqa: F821
    versions: list["DatasetVersion"] = Relationship(
        back_populates="dataset",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class DatasetVersion(TimestampedModel, table=True):
    """A point-in-time processed/cleaned representation of a dataset. Raw v0 is immutable."""

    __tablename__ = "dataset_versions"

    dataset_id: uuid.UUID = Field(foreign_key="datasets.id", index=True)
    version_number: int
    parquet_object_key: str = Field(max_length=1000)
    row_count: int = Field(default=0)
    column_count: int = Field(default=0)
    is_raw: bool = Field(default=False)
    parent_version_id: uuid.UUID | None = Field(default=None, foreign_key="dataset_versions.id")

    dataset: Dataset = Relationship(back_populates="versions")
    columns: list["DatasetColumn"] = Relationship(
        back_populates="dataset_version",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    cleaning_operations: list["CleaningOperation"] = Relationship(
        back_populates="dataset_version",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class DatasetColumn(TimestampedModel, table=True):
    __tablename__ = "dataset_columns"

    dataset_version_id: uuid.UUID = Field(foreign_key="dataset_versions.id", index=True)
    name: str = Field(max_length=300)
    ordinal: int
    raw_type: str = Field(max_length=50)
    semantic_type: str | None = Field(default=None, max_length=50)
    is_pii: bool = Field(default=False)

    dataset_version: DatasetVersion = Relationship(back_populates="columns")
    profile: "DataProfile" = Relationship(
        back_populates="column",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class DataProfile(TimestampedModel, table=True):
    """Per-column statistical profile, keyed 1:1 to a DatasetColumn."""

    __tablename__ = "data_profiles"

    dataset_column_id: uuid.UUID = Field(foreign_key="dataset_columns.id", unique=True, index=True)
    null_count: int = Field(default=0)
    unique_count: int = Field(default=0)
    stats: dict = Field(default_factory=dict, sa_column=Column(JSON))
    """Numeric/categorical/date stats, distribution shape, outlier refs — shape varies by type."""

    column: DatasetColumn = Relationship(back_populates="profile")


class CleaningOperation(TimestampedModel, table=True):
    """Auditable, deterministic transformation applied to produce a new DatasetVersion."""

    __tablename__ = "cleaning_operations"

    dataset_version_id: uuid.UUID = Field(foreign_key="dataset_versions.id", index=True)
    operation_type: str = Field(max_length=100)
    column_name: str | None = Field(default=None, max_length=300)
    params: dict = Field(default_factory=dict, sa_column=Column(JSON))
    valid_count: int = Field(default=0)
    invalid_count: int = Field(default=0)
    ai_suggested: bool = Field(default=False)

    dataset_version: DatasetVersion = Relationship(back_populates="cleaning_operations")
