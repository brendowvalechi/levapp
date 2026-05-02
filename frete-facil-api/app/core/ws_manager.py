import asyncio
import json
from collections import defaultdict
from fastapi import WebSocket


class ConnectionManager:
    """
    Manages WebSocket connections grouped by ride_id.
    Single-process model — scales with Redis pub/sub when needed.
    """

    def __init__(self):
        # ride_id (str) → set of active WebSocket connections
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, ride_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._rooms[ride_id].add(ws)

    def disconnect(self, ride_id: str, ws: WebSocket) -> None:
        self._rooms[ride_id].discard(ws)
        if not self._rooms[ride_id]:
            del self._rooms[ride_id]

    async def broadcast(self, ride_id: str, payload: dict) -> None:
        """Send JSON payload to every connection in a room."""
        dead: list[WebSocket] = []
        message = json.dumps(payload, default=str)
        for ws in list(self._rooms.get(ride_id, set())):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ride_id, ws)

    def room_size(self, ride_id: str) -> int:
        return len(self._rooms.get(ride_id, set()))


ws_manager = ConnectionManager()
