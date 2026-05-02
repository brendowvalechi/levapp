from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "levapp",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.notifications",
        "app.tasks.rides",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Sao_Paulo",
    enable_utc=True,
    task_default_queue="default",
    task_routes={
        "app.tasks.notifications.*": {"queue": "notifications"},
        "app.tasks.rides.*": {"queue": "default"},
    },
)
