import asyncio
import logging

from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.notifications.send_push_notification", bind=True, max_retries=2)
def send_push_notification(self, token: str, title: str, body: str, data: dict = None):
    """Send FCM push notification via legacy HTTP API."""
    if not token:
        return

    async def _send():
        from app.services.fcm import send_push
        await send_push(token, title, body, data or {})

    try:
        asyncio.run(_send())
    except Exception as exc:
        logger.error("Push notification failed: %s", exc)
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="app.tasks.notifications.send_push_to_user", bind=True, max_retries=2)
def send_push_to_user(self, user_id: str, title: str, body: str, data: dict = None):
    """Fetch user's FCM token from DB and send push notification."""
    async def _send():
        from app.database import AsyncSessionLocal
        from app.models.user import User
        from app.services.fcm import send_push
        import uuid
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(User.fcm_token).where(User.id == uuid.UUID(user_id))
            )
            token = result.scalar_one_or_none()
            if token:
                await send_push(token, title, body, data or {})

    try:
        asyncio.run(_send())
    except Exception as exc:
        logger.error("Push to user failed: %s", exc)
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(name="app.tasks.notifications.send_sms")
def send_sms(phone: str, message: str):
    """Send SMS via Zenvia/Twilio. TODO: integrate provider."""
    pass
