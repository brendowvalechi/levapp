from __future__ import annotations
import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_FCM_URL = "https://fcm.googleapis.com/fcm/send"


async def send_push(
    token: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> bool:
    """Send a push notification via FCM legacy HTTP API.
    Returns True on success, False otherwise.
    """
    if not settings.FCM_SERVER_KEY or not token:
        return False

    payload = {
        "to": token,
        "notification": {
            "title": title,
            "body": body,
            "sound": "default",
        },
        "data": data or {},
        "priority": "high",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.post(
                _FCM_URL,
                json=payload,
                headers={
                    "Authorization": f"key={settings.FCM_SERVER_KEY}",
                    "Content-Type": "application/json",
                },
            )
        if resp.status_code == 200:
            result = resp.json()
            if result.get("failure", 0) == 0:
                return True
            logger.warning("FCM delivery failure: %s", result)
        else:
            logger.warning("FCM HTTP %s: %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.error("FCM send error: %s", exc)

    return False
