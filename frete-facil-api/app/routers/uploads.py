from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user, require_driver
from app.models.user import User
from app.schemas.documents import PresignedUrlRequest, PresignedUrlResponse, DocumentsUpdateRequest
from app.services import storage as storage_service

router = APIRouter(prefix="/api/v1/uploads", tags=["uploads"])


@router.post("/presigned-url", response_model=PresignedUrlResponse)
async def get_presigned_url(
    data: PresignedUrlRequest,
    current_user: User = Depends(get_current_user),
):
    """Get a presigned URL to upload directly from the mobile app to R2."""
    from app.core.config import settings
    if not settings.R2_ACCESS_KEY_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Storage externo não configurado. Use o endpoint de upload direto.",
        )
    result = await storage_service.generate_presigned_url(data.folder, data.content_type)
    return result


@router.post("/file", status_code=status.HTTP_201_CREATED)
async def upload_file_direct(
    file: UploadFile = File(...),
    folder: str = Form(...),
    current_user: User = Depends(get_current_user),
):
    """Direct upload endpoint — used in dev (no R2) or as fallback."""
    allowed_folders = {"cnh", "selfie", "crlv", "vehicle", "avatar", "cargo"}
    if folder not in allowed_folders:
        raise HTTPException(status_code=400, detail=f"Folder inválido: {folder}")

    content = await file.read()
    url = await storage_service.upload_file(
        content=content,
        content_type=file.content_type or "image/jpeg",
        folder=folder,  # type: ignore[arg-type]
        original_filename=file.filename or "file",
        category="document" if folder in ("cnh", "crlv") else "image",
    )
    return {"url": url}
