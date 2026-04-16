"""add_tastemaker_fields

Revision ID: 2026041601
Revises: 8a40a843492e
Create Date: 2026-04-16 12:00:00.000000

Adds is_tastemaker, tastemaker_specialty, tastemaker_blurb columns to users.
Tastemakers are curated accounts surfaced to new users to fix the cold-start
problem (no friend network on day 1).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2026041601'
down_revision: Union[str, None] = '8a40a843492e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('is_tastemaker', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        'users',
        sa.Column('tastemaker_specialty', sa.String(length=100), nullable=True, server_default=''),
    )
    op.add_column(
        'users',
        sa.Column('tastemaker_blurb', sa.String(length=300), nullable=True, server_default=''),
    )
    op.create_index(op.f('ix_users_is_tastemaker'), 'users', ['is_tastemaker'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_is_tastemaker'), table_name='users')
    op.drop_column('users', 'tastemaker_blurb')
    op.drop_column('users', 'tastemaker_specialty')
    op.drop_column('users', 'is_tastemaker')
