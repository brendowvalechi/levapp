from __future__ import annotations
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.review import ReviewCreateRequest, ReviewResponse, DriverRatingResponse
from app.services import review as svc

router = APIRouter(prefix="/api/v1", tags=["reviews"])


@router.post(
    "/rides/{ride_id}/review",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_review(
    ride_id: uuid.UUID,
    body: ReviewCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await svc.create_review(db, user, ride_id, body)


@router.get("/rides/{ride_id}/reviews", response_model=list[ReviewResponse])
async def get_ride_reviews(
    ride_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await svc.get_ride_review(db, user, ride_id)


@router.get("/users/{user_id}/rating", response_model=DriverRatingResponse)
async def get_driver_rating(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await svc.get_driver_rating(db, user_id)


@router.get("/users/{user_id}/reviews", response_model=list[ReviewResponse])
async def list_driver_reviews(
    user_id: uuid.UUID,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return await svc.list_driver_reviews(db, user_id, limit)
