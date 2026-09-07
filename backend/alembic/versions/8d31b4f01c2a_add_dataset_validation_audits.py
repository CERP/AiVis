"""add dataset validation audits

Revision ID: 8d31b4f01c2a
Revises: 4406d812f315
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "8d31b4f01c2a"
down_revision: Union[str, Sequence[str], None] = "4406d812f315"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dataset_validation_audits",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("dataset_id", sa.Uuid(), nullable=False),
        sa.Column("source_version_id", sa.Uuid(), nullable=False),
        sa.Column("cleaned_version_id", sa.Uuid(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("report", sa.JSON(), nullable=False),
        sa.Column("profile", sa.JSON(), nullable=False),
        sa.Column("preview", sa.JSON(), nullable=False),
        sa.Column("validation_errors", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["dataset_id"], ["datasets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_version_id"], ["dataset_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["cleaned_version_id"], ["dataset_versions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dataset_validation_audits_dataset_id", "dataset_validation_audits", ["dataset_id"])
    op.create_index("ix_dataset_validation_audits_source_version_id", "dataset_validation_audits", ["source_version_id"])
    op.create_index("ix_dataset_validation_audits_cleaned_version_id", "dataset_validation_audits", ["cleaned_version_id"])


def downgrade() -> None:
    op.drop_table("dataset_validation_audits")
