import uuid
import json
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import decode_token
from app.core.ws_manager import ConnectionManager
from app.models.ride import RideStatus
from app.models.user import User
from app.services import tracking as track_service
from app.services.user import get_user_by_id

router = APIRouter(prefix="/api/v1", tags=["tracking"])

# Separate manager so tracking rooms don't collide with chat rooms
tracking_manager = ConnectionManager()


# ─── REST ────────────────────────────────────────────────────────────────────

@router.get("/rides/{ride_id}/driver-location")
async def get_driver_location(
    ride_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await track_service.resolve_participant(db, current_user, ride_id)
    loc = await track_service.get_location(str(ride_id))
    if not loc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Localização do motorista não disponível",
        )
    return loc


# ─── WebSocket ────────────────────────────────────────────────────────────────

@router.websocket("/ws/tracking/{ride_id}")
async def websocket_tracking(
    ride_id: uuid.UUID,
    ws: WebSocket,
    token: Annotated[Optional[str], Query()] = None,
    db: AsyncSession = Depends(get_db),
):
    # Authenticate
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

    try:
        ride, is_driver = await track_service.resolve_participant(db, current_user, ride_id)
    except HTTPException as e:
        await ws.close(code=4003, reason=e.detail)
        return

    room = str(ride_id)
    await tracking_manager.connect(room, ws)

    # Send current location snapshot on connect (if available)
    loc = await track_service.get_location(room)
    if loc:
        await ws.send_json({"type": "snapshot", **loc})

    # Send current ride status
    await ws.send_json({"type": "status_update", "status": ride.status, "ride_id": room})

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "detail": "JSON inválido"})
                continue

            msg_type = data.get("type")

            if msg_type == "location":
                if not is_driver:
                    await ws.send_json({"type": "error", "detail": "Apenas o motorista envia localização"})
                    continue
                lat = data.get("lat")
                lng = data.get("lng")
                if lat is None or lng is None:
                    await ws.send_json({"type": "error", "detail": "lat/lng obrigatórios"})
                    continue
                # Persist in Redis + broadcast to all in room (including client)
                saved = await track_service.save_location(
                    room, str(current_user.id), float(lat), float(lng)
                )
                await tracking_manager.broadcast(room, {"type": "location", **saved})

            elif msg_type == "status":
                if not is_driver:
                    await ws.send_json({"type": "error", "detail": "Apenas o motorista altera o status"})
                    continue
                new_status_str = data.get("status")
                try:
                    new_status = RideStatus(new_status_str)
                except (ValueError, TypeError):
                    await ws.send_json({"type": "error", "detail": f"Status inválido: {new_status_str}"})
                    continue

                # Reload ride from DB to have fresh status
                from sqlalchemy import select as sa_select
                from app.models.ride import Ride
                r = await db.execute(sa_select(Ride).where(Ride.id == ride_id))
                fresh_ride = r.scalar_one_or_none()
                if not fresh_ride:
                    continue

                try:
                    updated_ride = await track_service.update_ride_status(
                        db, current_user, fresh_ride, new_status
                    )
                except HTTPException as e:
                    await ws.send_json({"type": "error", "detail": e.detail})
                    continue

                await tracking_manager.broadcast(
                    room,
                    {"type": "status_update", "status": updated_ride.status, "ride_id": room},
                )

    except WebSocketDisconnect:
        pass
    finally:
        tracking_manager.disconnect(room, ws)
