"""visualizations is_favorite column

Revision ID: 9f3c6b2a1d47
Revises: c2a9e1f4b7d0
Create Date: 2026-09-08 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9f3c6b2a1d47"
down_revision: Union[str, Sequence[str], None] = "c2a9e1f4b7d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "visualizations",
        sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        op.f("ix_visualizations_is_favorite"), "visualizations", ["is_favorite"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_visualizations_is_favorite"), table_name="visualizations")
    op.drop_column("visualizations", "is_favorite")
