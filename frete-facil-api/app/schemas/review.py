from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class ReviewCreateRequest(BaseModel):
    rating: int
    comment: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Avaliação deve ser entre 1 e 5")
        return v

    @field_validator("comment")
    @classmethod
    def validate_comment(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.strip()) > 500:
            raise ValueError("Comentário deve ter no máximo 500 caracteres")
        return v.strip() if v else None


class ReviewResponse(BaseModel):
    id: uuid.UUID
    ride_id: uuid.UUID
    reviewer_id: uuid.UUID
    reviewed_id: uuid.UUID
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DriverRatingResponse(BaseModel):
    driver_id: uuid.UUID
    rating_avg: float
    rating_count: int
