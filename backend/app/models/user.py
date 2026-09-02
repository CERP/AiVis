import uuid
from enum import StrEnum

from sqlmodel import Field, Relationship

from app.models.base import TimestampedModel


class MembershipRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class User(TimestampedModel, table=True):
    __tablename__ = "users"

    email: str = Field(unique=True, index=True, max_length=320)
    hashed_password: str
    full_name: str | None = Field(default=None, max_length=200)
    is_active: bool = Field(default=True)

    memberships: list["Membership"] = Relationship(back_populates="user")


class Organization(TimestampedModel, table=True):
    __tablename__ = "organizations"

    name: str = Field(max_length=200)
    slug: str = Field(unique=True, index=True, max_length=200)

    memberships: list["Membership"] = Relationship(back_populates="organization")
    projects: list["Project"] = Relationship(back_populates="organization")  # noqa: F821


class Membership(TimestampedModel, table=True):
    __tablename__ = "memberships"

    user_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    organization_id: uuid.UUID = Field(foreign_key="organizations.id", index=True)
    role: MembershipRole = Field(default=MembershipRole.EDITOR)

    user: User = Relationship(back_populates="memberships")
    organization: Organization = Relationship(back_populates="memberships")
