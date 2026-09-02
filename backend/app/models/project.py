import uuid

from sqlmodel import Field, Relationship

from app.models.base import TimestampedModel


class Project(TimestampedModel, table=True):
    __tablename__ = "projects"

    organization_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    name: str = Field(max_length=200)
    description: str | None = Field(default=None, max_length=2000)

    organization: "Organization" = Relationship(back_populates="projects")  # noqa: F821
    datasets: list["Dataset"] = Relationship(back_populates="project")  # noqa: F821
