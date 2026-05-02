from pydantic import EmailStr, field_validator
from app.schemas.base import BaseSchema
from app.models.user import UserRole
import re


class RegisterRequest(BaseSchema):
    name: str
    email: EmailStr
    phone: str
    password: str
    role: UserRole = UserRole.client

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if len(digits) < 10 or len(digits) > 13:
            raise ValueError("Telefone inválido")
        return digits

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Senha deve ter no mínimo 6 caracteres")
        return v

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        if len(v.strip()) < 3:
            raise ValueError("Nome muito curto")
        return v.strip()


class LoginRequest(BaseSchema):
    email: EmailStr
    password: str


class RefreshRequest(BaseSchema):
    refresh_token: str


class OtpVerifyRequest(BaseSchema):
    phone: str
    code: str

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        return re.sub(r"\D", "", v)


class OtpResendRequest(BaseSchema):
    phone: str

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        return re.sub(r"\D", "", v)


class TokenResponse(BaseSchema):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseSchema):
    email: EmailStr


class ResetPasswordRequest(BaseSchema):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Senha deve ter no mínimo 6 caracteres")
        return v
