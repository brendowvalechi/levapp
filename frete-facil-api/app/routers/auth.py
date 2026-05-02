from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from redis.asyncio import Redis

from app.database import get_db
from app.core.redis import get_redis
from app.core.limiter import limiter
from app.schemas.auth import (
    RegisterRequest, LoginRequest, RefreshRequest,
    OtpVerifyRequest, OtpResendRequest, TokenResponse,
)
from app.schemas.user import UserResponse
from app.services import auth as auth_service

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request: Request,
    data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    user = await auth_service.register_user(db, data)
    await auth_service.send_phone_otp(redis, user.phone)
    return user


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    _, access, refresh = await auth_service.login_user(db, data)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest):
    access, refresh = await auth_service.refresh_tokens(data.refresh_token)
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/otp/verify", response_model=UserResponse)
@limiter.limit("10/minute")
async def verify_otp(
    request: Request,
    data: OtpVerifyRequest,
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis),
):
    user = await auth_service.verify_phone_otp(db, redis, data.phone, data.code)
    return user


@router.post("/otp/resend", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/minute")
async def resend_otp(
    request: Request,
    data: OtpResendRequest,
    redis: Redis = Depends(get_redis),
):
    await auth_service.send_phone_otp(redis, data.phone)
