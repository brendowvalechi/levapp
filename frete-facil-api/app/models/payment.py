import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Float, Text, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import TimestampMixin


class PaymentStatus(str, enum.Enum):
    pending = "pending"       # aguardando pagamento
    approved = "approved"     # pago — em escrow na plataforma
    in_escrow = "in_escrow"   # corrida concluída — aguardando liberação
    released = "released"     # transferido ao motorista
    refunded = "refunded"     # reembolsado ao cliente
    cancelled = "cancelled"
    failed = "failed"


class PaymentMethod(str, enum.Enum):
    pix = "pix"
    checkout_pro = "checkout_pro"  # Mercado Pago Checkout (cartão, etc.)


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"
    __table_args__ = (UniqueConstraint("ride_id", name="uq_payments_ride_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ride_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rides.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    amount: Mapped[float] = mapped_column(Float, nullable=False)
    platform_fee: Mapped[float] = mapped_column(Float, nullable=False)
    driver_amount: Mapped[float] = mapped_column(Float, nullable=False)

    method: Mapped[PaymentMethod] = mapped_column(nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        default=PaymentStatus.pending, nullable=False, index=True
    )

    # Mercado Pago IDs
    mp_payment_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    mp_preference_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Pix data
    pix_qr_code_base64: Mapped[str | None] = mapped_column(Text, nullable=True)
    pix_copy_paste: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Checkout Pro URL
    checkout_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    ride = relationship("Ride", foreign_keys=[ride_id], lazy="select")
    client = relationship("User", foreign_keys=[client_id], lazy="select")
    driver = relationship("User", foreign_keys=[driver_id], lazy="select")

    def __repr__(self) -> str:
        return f"<Payment ride={self.ride_id} status={self.status}>"
