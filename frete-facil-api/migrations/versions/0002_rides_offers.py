"""rides and offers

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-30

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "rides",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("client_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("origin_address", sa.Text, nullable=False),
        sa.Column("origin_lat", sa.Float, nullable=False),
        sa.Column("origin_lng", sa.Float, nullable=False),
        sa.Column("destination_address", sa.Text, nullable=False),
        sa.Column("destination_lat", sa.Float, nullable=False),
        sa.Column("destination_lng", sa.Float, nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("vehicle_type_preference", sa.String(30), nullable=True),
        sa.Column("estimated_weight_kg", sa.Integer, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("photos", JSON, nullable=False, server_default="[]"),
        sa.Column("accepted_offer_id", UUID(as_uuid=True), nullable=True),
        sa.Column("distance_km", sa.Float, nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW() + INTERVAL '2 hours'"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_rides_client_id", "rides", ["client_id"])
    op.create_index("ix_rides_status", "rides", ["status"])

    op.create_table(
        "offers",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("ride_id", UUID(as_uuid=True), sa.ForeignKey("rides.id", ondelete="CASCADE"), nullable=False),
        sa.Column("driver_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("price", sa.Float, nullable=False),
        sa.Column("message", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_offers_ride_id", "offers", ["ride_id"])
    op.create_index("ix_offers_driver_id", "offers", ["driver_id"])


def downgrade() -> None:
    op.drop_index("ix_offers_driver_id", "offers")
    op.drop_index("ix_offers_ride_id", "offers")
    op.drop_table("offers")
    op.drop_index("ix_rides_status", "rides")
    op.drop_index("ix_rides_client_id", "rides")
    op.drop_table("rides")
