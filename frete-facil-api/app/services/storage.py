import uuid
import mimetypes
from pathlib import Path
from typing import Literal
from app.core.config import settings

# Allowed MIME types per document category
ALLOWED_MIME = {
    "image": {"image/jpeg", "image/png", "image/webp"},
    "document": {"image/jpeg", "image/png", "application/pdf"},
}

MAX_SIZE_MB = 10
MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

StorageFolder = Literal["cnh", "selfie", "crlv", "vehicle", "avatar", "cargo"]


def _validate_file(content: bytes, content_type: str, category: str = "image") -> None:
    if len(content) > MAX_SIZE_BYTES:
        raise ValueError(f"Arquivo muito grande. Máximo {MAX_SIZE_MB}MB.")
    allowed = ALLOWED_MIME.get(category, ALLOWED_MIME["image"])
    if content_type not in allowed:
        raise ValueError(f"Tipo de arquivo não permitido: {content_type}")


def _generate_key(folder: StorageFolder, filename: str) -> str:
    ext = Path(filename).suffix.lower() or ".jpg"
    return f"{folder}/{uuid.uuid4().hex}{ext}"


async def upload_file(
    content: bytes,
    content_type: str,
    folder: StorageFolder,
    original_filename: str = "file",
    category: str = "image",
) -> str:
    """Upload file and return its public URL."""
    _validate_file(content, content_type, category)
    key = _generate_key(folder, original_filename)

    if settings.STORAGE_PROVIDER == "r2" and settings.R2_ACCESS_KEY_ID:
        return await _upload_r2(content, content_type, key)
    else:
        return await _upload_local(content, key)


async def _upload_r2(content: bytes, content_type: str, key: str) -> str:
    import boto3
    from botocore.config import Config

    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )
    s3.put_object(
        Bucket=settings.R2_BUCKET_NAME,
        Key=key,
        Body=content,
        ContentType=content_type,
    )
    base = settings.R2_PUBLIC_URL.rstrip("/")
    return f"{base}/{key}"


async def _upload_local(content: bytes, key: str) -> str:
    """Dev fallback: save to ./uploads/ and return a local URL."""
    upload_dir = Path("uploads") / Path(key).parent
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = Path("uploads") / key
    file_path.write_bytes(content)
    return f"http://localhost:8000/uploads/{key}"


async def generate_presigned_url(folder: StorageFolder, content_type: str) -> dict:
    """Generate a presigned URL for direct client upload."""
    if not settings.R2_ACCESS_KEY_ID:
        raise ValueError("Storage não configurado. Configure R2_ACCESS_KEY_ID.")

    ext = mimetypes.guess_extension(content_type) or ".bin"
    key = f"{folder}/{uuid.uuid4().hex}{ext}"

    import boto3
    from botocore.config import Config

    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )
    presigned = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key, "ContentType": content_type},
        ExpiresIn=300,
    )
    public_url = f"{settings.R2_PUBLIC_URL.rstrip('/')}/{key}"
    return {"upload_url": presigned, "public_url": public_url, "key": key}
