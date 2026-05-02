"""payments

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-30

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("ride_id", UUID(as_uuid=True), sa.ForeignKey("rides.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("driver_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.Float, nullable=False),
        sa.Column("platform_fee", sa.Float, nullable=False),
        sa.Column("driver_amount", sa.Float, nullable=False),
        sa.Column("method", sa.String(30), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("mp_payment_id", sa.String(100), nullable=True),
        sa.Column("mp_preference_id", sa.String(100), nullable=True),
        sa.Column("pix_qr_code_base64", sa.Text, nullable=True),
        sa.Column("pix_copy_paste", sa.Text, nullable=True),
        sa.Column("checkout_url", sa.Text, nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("ride_id", name="uq_payments_ride_id"),
    )
    op.create_index("ix_payments_ride_id", "payments", ["ride_id"])
    op.create_index("ix_payments_status", "payments", ["status"])
    op.create_index("ix_payments_mp_payment_id", "payments", ["mp_payment_id"])


def downgrade() -> None:
    op.drop_index("ix_payments_mp_payment_id", "payments")
    op.drop_index("ix_payments_status", "payments")
    op.drop_index("ix_payments_ride_id", "payments")
    op.drop_table("payments")
