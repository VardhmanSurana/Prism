"""add_ai_summary_to_photos

Revision ID: 6f3a1b2c4d5e
Revises: f425e8b05638
Create Date: 2026-05-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6f3a1b2c4d5e'
down_revision: Union[str, Sequence[str], None] = 'f425e8b05638'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('photos', sa.Column('ai_summary', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('photos', 'ai_summary')
