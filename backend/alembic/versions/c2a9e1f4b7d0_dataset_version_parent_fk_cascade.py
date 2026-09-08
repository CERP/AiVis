"""dataset_versions parent_version_id fk ondelete cascade

Revision ID: c2a9e1f4b7d0
Revises: 8d31b4f01c2a
Create Date: 2026-09-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c2a9e1f4b7d0"
down_revision: Union[str, Sequence[str], None] = "8d31b4f01c2a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "dataset_versions_parent_version_id_fkey",
        "dataset_versions",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "dataset_versions_parent_version_id_fkey",
        "dataset_versions",
        "dataset_versions",
        ["parent_version_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "dataset_versions_parent_version_id_fkey",
        "dataset_versions",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "dataset_versions_parent_version_id_fkey",
        "dataset_versions",
        "dataset_versions",
        ["parent_version_id"],
        ["id"],
    )
