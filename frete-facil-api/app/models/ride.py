import uuid
import enum
from datetime import datetime, timezone, timedelta
from sqlalchemy import String, Float, Integer, ForeignKey, Text, JSON, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin


class RideStatus(str, enum.Enum):
    open = "open"
    matched = "matched"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    expired = "expired"


class RideCategory(str, enum.Enum):
    carreto_simples = "carreto_simples"
    mudanca_residencial = "mudanca_residencial"
    mudanca_comercial = "mudanca_comercial"
    entrega_rapida = "entrega_rapida"
    outros = "outros"


class OfferStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    cancelled = "cancelled"


class Ride(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "rides"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Origin
    origin_address: Mapped[str] = mapped_column(Text, nullable=False)
    origin_lat: Mapped[float] = mapped_column(Float, nullable=False)
    origin_lng: Mapped[float] = mapped_column(Float, nullable=False)

    # Destination
    destination_address: Mapped[str] = mapped_column(Text, nullable=False)
    destination_lat: Mapped[float] = mapped_column(Float, nullable=False)
    destination_lng: Mapped[float] = mapped_column(Float, nullable=False)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[RideCategory] = mapped_column(nullable=False)
    vehicle_type_preference: Mapped[str | None] = mapped_column(String(30), nullable=True)
    estimated_weight_kg: Mapped[int | None] = mapped_column(Integer, nullable=True)

    status: Mapped[RideStatus] = mapped_column(default=RideStatus.open, nullable=False, index=True)

    # JSON list of photo URLs
    photos: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    # Plain UUID (no FK constraint to avoid circular dep with offers)
    accepted_offer_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc) + timedelta(hours=2),
    )

    # Relationships
    client = relationship("User", foreign_keys=[client_id], lazy="select")
    offers: Mapped[list["Offer"]] = relationship("Offer", back_populates="ride", lazy="select")

    def __repr__(self) -> str:
        return f"<Ride {self.id} status={self.status}>"


class Offer(Base, TimestampMixin):
    __tablename__ = "offers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ride_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rides.id", ondelete="CASCADE"), nullable=False, index=True
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    price: Mapped[float] = mapped_column(Float, nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[OfferStatus] = mapped_column(default=OfferStatus.pending, nullable=False)

    # Relationships
    ride: Mapped["Ride"] = relationship("Ride", back_populates="offers")
    driver = relationship("User", foreign_keys=[driver_id], lazy="select")

    def __repr__(self) -> str:
        return f"<Offer {self.id} ride={self.ride_id} status={self.status}>"
