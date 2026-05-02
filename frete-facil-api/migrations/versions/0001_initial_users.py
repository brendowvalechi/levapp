"""initial: users, driver_profiles, vehicles

Revision ID: 0001
Revises:
Create Date: 2026-04-30

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSON

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("phone", sa.String(20), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="client"),
        sa.Column("avatar_url", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("email_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("phone_verified", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("fcm_token", sa.String(512), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_phone", "users", ["phone"])

    op.create_table(
        "driver_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("cnh_number", sa.String(20), nullable=True),
        sa.Column("cnh_front_url", sa.Text, nullable=True),
        sa.Column("cnh_back_url", sa.Text, nullable=True),
        sa.Column("selfie_url", sa.Text, nullable=True),
        sa.Column("verification_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("rejection_reason", sa.Text, nullable=True),
        sa.Column("service_radius_km", sa.Integer, nullable=False, server_default="15"),
        sa.Column("service_types", JSON, nullable=False, server_default="[]"),
        sa.Column("working_days", JSON, nullable=False, server_default="{}"),
        sa.Column("working_hours", JSON, nullable=False, server_default="{}"),
        sa.Column("pix_key", sa.String(100), nullable=True),
        sa.Column("is_online", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("rating_avg", sa.Float, nullable=False, server_default="0"),
        sa.Column("total_rides", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "vehicles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("driver_id", UUID(as_uuid=True), sa.ForeignKey("driver_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("plate", sa.String(10), nullable=False, unique=True),
        sa.Column("brand", sa.String(80), nullable=False),
        sa.Column("model", sa.String(80), nullable=False),
        sa.Column("year", sa.Integer, nullable=False),
        sa.Column("capacity_kg", sa.Integer, nullable=True),
        sa.Column("color", sa.String(40), nullable=True),
        sa.Column("photos", JSON, nullable=False, server_default="[]"),
        sa.Column("crlv_url", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_vehicles_driver_id", "vehicles", ["driver_id"])


def downgrade() -> None:
    op.drop_table("vehicles")
    op.drop_table("driver_profiles")
    op.drop_index("ix_users_phone", "users")
    op.drop_index("ix_users_email", "users")
    op.drop_table("users")
