"""WebRTC signaling server.

Peers exchange connection handshakes (SDP offers/answers, ICE candidates)
through this server, then talk directly to each other over a WebRTC data
channel. No whiteboard content ever passes through here. The message
protocol (subscribe/unsubscribe/publish/ping) matches the y-webrtc
signaling protocol so the y-webrtc JS client can connect without a custom
provider.
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

topics: dict[str, set[WebSocket]] = {}


async def send(ws: WebSocket, message: dict[str, Any]) -> None:
    try:
        await ws.send_text(json.dumps(message))
    except Exception:
        pass


@app.websocket("/")
async def signaling(ws: WebSocket) -> None:
    await ws.accept()
    subscribed: set[str] = set()

    try:
        while True:
            raw = await ws.receive_text()
            message = json.loads(raw)
            msg_type = message.get("type")

            if msg_type == "subscribe":
                for topic in message.get("topics", []):
                    topics.setdefault(topic, set()).add(ws)
                    subscribed.add(topic)

            elif msg_type == "unsubscribe":
                for topic in message.get("topics", []):
                    topics.get(topic, set()).discard(ws)

            elif msg_type == "publish":
                topic = message.get("topic")
                receivers = topics.get(topic) if topic else None
                if receivers:
                    message["clients"] = len(receivers)
                    for receiver in receivers:
                        await send(receiver, message)

            elif msg_type == "ping":
                await send(ws, {"type": "pong"})

    except WebSocketDisconnect:
        pass
    finally:
        for topic in subscribed:
            remaining = topics.get(topic)
            if remaining:
                remaining.discard(ws)
                if not remaining:
                    topics.pop(topic, None)
