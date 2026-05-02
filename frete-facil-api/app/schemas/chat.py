from __future__ import annotations
import uuid
from datetime import datetime
from typing import Optional
from app.schemas.base import BaseSchema


class MessageCreate(BaseSchema):
    content: str


class SenderInfo(BaseSchema):
    id: uuid.UUID
    name: str


class MessageResponse(BaseSchema):
    id: uuid.UUID
    ride_id: uuid.UUID
    sender_id: uuid.UUID
    content: str
    is_read: bool
    created_at: datetime
    sender: Optional[SenderInfo] = None


class ConversationResponse(BaseSchema):
    """One entry in the conversations list — a matched ride + last message."""
    ride_id: uuid.UUID
    other_user_id: uuid.UUID
    other_user_name: str
    last_message: Optional[str]
    last_message_at: Optional[datetime]
    unread_count: int


# ─── WebSocket wire protocol ──────────────────────────────────────────────────
# Client → Server:  {"type": "message", "content": "..."}
# Server → Client:  {"type": "message", ...MessageResponse fields...}
#                   {"type": "read",    "message_id": "..."}
#                   {"type": "error",   "detail": "..."}
