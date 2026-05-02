import uuid
import json
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import decode_token
from app.core.ws_manager import ws_manager
from app.models.user import User
from app.schemas.chat import MessageResponse, MessageCreate, ConversationResponse
from app.services import chat as chat_service
from app.services.user import get_user_by_id

router = APIRouter(prefix="/api/v1", tags=["chat"])


# ─── REST ────────────────────────────────────────────────────────────────────

@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await chat_service.list_conversations(db, current_user)


@router.get("/rides/{ride_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    ride_id: uuid.UUID,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    before_id: Annotated[Optional[uuid.UUID], Query()] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await chat_service.get_messages(db, current_user, ride_id, limit, before_id)


@router.post("/rides/{ride_id}/messages", response_model=MessageResponse, status_code=201)
async def send_message(
    ride_id: uuid.UUID,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """REST fallback for sending messages (e.g. push notification scenario)."""
    if not data.content.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Mensagem não pode ser vazia")
    msg = await chat_service.save_message(db, current_user, ride_id, data.content)
    payload = _msg_payload(msg)
    await ws_manager.broadcast(str(ride_id), payload)
    return msg


@router.post("/rides/{ride_id}/messages/read")
async def mark_read(
    ride_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = await chat_service.mark_read(db, current_user, ride_id)
    return {"marked_read": count}


# ─── WebSocket ────────────────────────────────────────────────────────────────

@router.websocket("/ws/chat/{ride_id}")
async def websocket_chat(
    ride_id: uuid.UUID,
    ws: WebSocket,
    token: Annotated[Optional[str], Query()] = None,
    db: AsyncSession = Depends(get_db),
):
    # Authenticate via query-param token (WS handshake doesn't support headers)
    if not token:
        await ws.close(code=4001, reason="Token obrigatório")
        return

    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        await ws.close(code=4001, reason="Token inválido")
        return

    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, KeyError):
        await ws.close(code=4001, reason="Token malformado")
        return

    current_user = await get_user_by_id(db, user_id)
    if not current_user:
        await ws.close(code=4001, reason="Usuário não encontrado")
        return

    room = str(ride_id)
    await ws_manager.connect(room, ws)

    # Send last 50 messages as history burst on connect
    try:
        history = await chat_service.get_messages(db, current_user, ride_id, limit=50)
        for msg in history:
            await ws.send_json(_msg_payload(msg))
    except HTTPException:
        await ws.close(code=4003, reason="Acesso negado a esta corrida")
        ws_manager.disconnect(room, ws)
        return

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "detail": "JSON inválido"})
                continue

            if data.get("type") == "message":
                content = (data.get("content") or "").strip()
                if not content:
                    await ws.send_json({"type": "error", "detail": "Mensagem vazia"})
                    continue
                msg = await chat_service.save_message(db, current_user, ride_id, content)
                await ws_manager.broadcast(room, _msg_payload(msg))

            elif data.get("type") == "read":
                await chat_service.mark_read(db, current_user, ride_id)

    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(room, ws)


# ─── Helper ──────────────────────────────────────────────────────────────────

def _msg_payload(msg) -> dict:
    return {
        "type": "message",
        "id": str(msg.id),
        "ride_id": str(msg.ride_id),
        "sender_id": str(msg.sender_id),
        "sender_name": msg.sender.name if msg.sender else "",
        "content": msg.content,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat(),
    }
