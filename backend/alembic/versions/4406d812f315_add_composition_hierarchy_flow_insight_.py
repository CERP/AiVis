"""add composition hierarchy flow insight types

Revision ID: 4406d812f315
Revises: 47b63b3d240e
Create Date: 2026-09-04 09:54:59.544267

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '4406d812f315'
down_revision: Union[str, Sequence[str], None] = '47b63b3d240e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Adding enum values is safe within a transaction as long as nothing in this same
    # transaction reads the new value back (Postgres 12+ restriction).
    op.execute("ALTER TYPE insighttype ADD VALUE IF NOT EXISTS 'COMPOSITION'")
    op.execute("ALTER TYPE insighttype ADD VALUE IF NOT EXISTS 'HIERARCHY'")
    op.execute("ALTER TYPE insighttype ADD VALUE IF NOT EXISTS 'FLOW'")


def downgrade() -> None:
    """Downgrade schema."""
    # Postgres has no ALTER TYPE ... DROP VALUE; downgrading a widened enum requires rebuilding
    # the type, which is unsafe if any row already uses the new values. Left as a no-op --
    # matches the project's existing convention of not supporting enum-value downgrades.
    pass
