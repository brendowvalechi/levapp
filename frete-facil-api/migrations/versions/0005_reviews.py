"""reviews

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-30

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "reviews",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("ride_id", UUID(as_uuid=True), sa.ForeignKey("rides.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewer_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewed_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rating", sa.Integer, nullable=False),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("ride_id", "reviewer_id", name="uq_reviews_ride_reviewer"),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating"),
    )
    op.create_index("ix_reviews_ride_id", "reviews", ["ride_id"])
    op.create_index("ix_reviews_reviewer_id", "reviews", ["reviewer_id"])
    op.create_index("ix_reviews_reviewed_id", "reviews", ["reviewed_id"])

    # Add rating_count to driver_profiles
    op.add_column("driver_profiles", sa.Column("rating_count", sa.Integer, nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("driver_profiles", "rating_count")
    op.drop_index("ix_reviews_reviewed_id", "reviews")
    op.drop_index("ix_reviews_reviewer_id", "reviews")
    op.drop_index("ix_reviews_ride_id", "reviews")
    op.drop_table("reviews")
