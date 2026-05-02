from __future__ import annotations
import asyncio
import uuid

from app.core.celery_app import celery_app
from app.database import AsyncSessionLocal


@celery_app.task(name="app.tasks.payments.release_driver_payment", bind=True, max_retries=3)
def release_driver_payment(self, payment_id: str) -> None:
    """Release escrow funds to driver after ride completion."""
    async def _release():
        from app.services.payment import release_payment
        async with AsyncSessionLocal() as db:
            await release_payment(db, uuid.UUID(payment_id))

    try:
        asyncio.run(_release())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
