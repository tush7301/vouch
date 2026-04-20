"""widen_experiences_cover_photo_url

Revision ID: 2026041902
Revises: 2026041901
Create Date: 2026-04-19 22:30:00.000000

The Experience model declares `cover_photo_url` as Text, but the initial
migration created it as VARCHAR(500). Google Places (New) photo URLs carry
opaque photo-reference tokens that routinely exceed 500 chars, which fails
the bulk place-seeding script with StringDataRightTruncation.

Widens the column to TEXT to match the model. Idempotent — skips if already
TEXT (prod got this applied ad-hoc to unblock the 2026-04-19 seed).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2026041902'
down_revision: Union[str, None] = '2026041901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _current_type(bind, column: str) -> str:
    return bind.execute(
        sa.text(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name='experiences' AND column_name=:c"
        ),
        {"c": column},
    ).scalar() or ""


def upgrade() -> None:
    bind = op.get_bind()
    if _current_type(bind, 'cover_photo_url') != 'text':
        op.alter_column(
            'experiences',
            'cover_photo_url',
            type_=sa.Text(),
            existing_nullable=True,
        )


def downgrade() -> None:
    # Intentionally no-op: narrowing to VARCHAR(500) would truncate existing
    # Google Places URLs and break the app.
    pass
