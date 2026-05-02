from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user, require_driver
from app.models.user import User
from app.schemas.documents import DocumentsUpdateRequest, VehicleCrlvUpdateRequest
from app.schemas.user import DriverProfileResponse, VehicleResponse
from app.services import documents as doc_service

router = APIRouter(prefix="/api/v1/driver", tags=["driver documents"])


@router.get("/verification-status")
async def get_verification_status(
    current_user: User = Depends(require_driver),
):
    return await doc_service.get_verification_status(current_user)


@router.patch("/documents", response_model=DriverProfileResponse)
async def update_documents(
    data: DocumentsUpdateRequest,
    current_user: User = Depends(require_driver),
    db: AsyncSession = Depends(get_db),
):
    """Update document URLs after uploading to storage."""
    return await doc_service.update_driver_documents(db, current_user, data)


@router.patch("/vehicles/{vehicle_id}/crlv", response_model=VehicleResponse)
async def update_vehicle_crlv(
    vehicle_id: str,
    data: VehicleCrlvUpdateRequest,
    current_user: User = Depends(require_driver),
    db: AsyncSession = Depends(get_db),
):
    return await doc_service.update_vehicle_crlv(db, current_user, vehicle_id, data.crlv_url)
