import uuid
import enum
from sqlalchemy import String, Boolean, Float, Integer, ForeignKey, Text, JSON
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.models.base import TimestampMixin, SoftDeleteMixin


class UserRole(str, enum.Enum):
    client = "client"
    driver = "driver"
    both = "both"


class VerificationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class VehicleType(str, enum.Enum):
    furgao = "furgao"
    caminhonete = "caminhonete"
    saveiro = "saveiro"
    strada = "strada"
    hr = "hr"
    caminhao_pequeno = "caminhao_pequeno"
    outros = "outros"


class User(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(default=UserRole.client, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Push notification token (FCM)
    fcm_token: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Relationships
    driver_profile: Mapped["DriverProfile | None"] = relationship(
        "DriverProfile", back_populates="user", uselist=False, lazy="select"
    )

    def __repr__(self) -> str:
        return f"<User {self.email}>"


class DriverProfile(Base, TimestampMixin):
    __tablename__ = "driver_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # Documents
    cnh_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cnh_front_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    cnh_back_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    selfie_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    verification_status: Mapped[VerificationStatus] = mapped_column(
        default=VerificationStatus.pending, nullable=False
    )
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Service config
    service_radius_km: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    # JSON: ["carreto_simples", "mudanca_com_ajudante", "carga_leve"]
    service_types: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    # JSON: {"seg": true, "ter": true, ..., "dom": false}
    working_days: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    # JSON: {"start": "08:00", "end": "18:00"}
    working_hours: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    pix_key: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Stats (updated on each review)
    rating_avg: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    rating_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_rides: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="driver_profile")
    vehicles: Mapped[list["Vehicle"]] = relationship(
        "Vehicle", back_populates="driver_profile", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<DriverProfile user_id={self.user_id}>"


class Vehicle(Base, TimestampMixin):
    __tablename__ = "vehicles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("driver_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    type: Mapped[VehicleType] = mapped_column(nullable=False)
    plate: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    brand: Mapped[str] = mapped_column(String(80), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    capacity_kg: Mapped[int | None] = mapped_column(Integer, nullable=True)
    color: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # JSON: list of URL strings
    photos: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    crlv_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    driver_profile: Mapped["DriverProfile"] = relationship("DriverProfile", back_populates="vehicles")

    def __repr__(self) -> str:
        return f"<Vehicle {self.plate}>"
