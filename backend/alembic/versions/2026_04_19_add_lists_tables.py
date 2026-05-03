"""add_lists_tables

Revision ID: 2026041901
Revises: 2026041601
Create Date: 2026-04-19 21:00:00.000000

Creates the `lists` and `list_items` tables for user-curated experience lists
(the Lists tab on Profile). Brought in with upstream's Feed/Map/Search/Profile
polish merge — the model was added but no migration shipped.

Idempotent: skips table creation when the tables already exist (some prod
databases got them created out-of-band before this migration was authored).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '2026041901'
down_revision: Union[str, None] = '2026041601'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    if 'lists' not in existing:
        op.create_table(
            'lists',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('name', sa.String(length=200), nullable=False),
            sa.Column('description', sa.Text(), nullable=True, server_default=''),
            sa.Column('cover_photo_url', sa.String(length=500), nullable=True, server_default=''),
            sa.Column('is_public', sa.Boolean(), nullable=True, server_default=sa.true()),
            sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        )
        op.create_index(op.f('ix_lists_user_id'), 'lists', ['user_id'], unique=False)

    if 'list_items' not in existing:
        op.create_table(
            'list_items',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('list_id', UUID(as_uuid=True), sa.ForeignKey('lists.id'), nullable=False),
            sa.Column('experience_id', UUID(as_uuid=True), sa.ForeignKey('experiences.id'), nullable=False),
            sa.Column('note', sa.Text(), nullable=True, server_default=''),
            sa.Column('position', sa.String(length=10), nullable=True, server_default='0'),
            sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        )
        op.create_index(op.f('ix_list_items_list_id'), 'list_items', ['list_id'], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing = set(inspector.get_table_names())

    if 'list_items' in existing:
        op.drop_index(op.f('ix_list_items_list_id'), table_name='list_items')
        op.drop_table('list_items')
    if 'lists' in existing:
        op.drop_index(op.f('ix_lists_user_id'), table_name='lists')
        op.drop_table('lists')
