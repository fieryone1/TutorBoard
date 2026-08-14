# TutorBoard

An online whiteboard for maths tutors. Current scope: a shared canvas that
syncs peer-to-peer over WebRTC, with a small Python signaling server used
only to establish the P2P connection (drawing data never touches it).

```
backend/    FastAPI WebRTC signaling server (Python, managed with uv)
frontend/   React + TypeScript + Vite canvas (react-konva + Yjs + y-webrtc)
```

## Prerequisites

- [uv](https://docs.astral.sh/uv/) (manages the Python version and deps for `backend/`)
- Node.js 18+ and npm (for `frontend/`)

Neither backend nor frontend need a manual virtualenv or `npm install` step
beyond what's below — `uv run` and `npm install` set everything up.

## Running it locally

**1. Start the signaling server** (terminal 1):

```bash
cd backend
uv run uvicorn app.main:app --port 4444
```

This serves a WebSocket at `ws://localhost:4444/`. You should see
`Uvicorn running on http://0.0.0.0:4444`.

**2. Start the frontend** (terminal 2):

```bash
cd frontend
npm install   # first time only
npm run dev
```

This serves the app at `http://localhost:5173/`.

**3. Open it in a browser:**

```
http://localhost:5173/?room=demo-room
```

The `room` query param is the whiteboard's ID — anyone who opens the same
room name joins the same session.

## Testing it

**Basic sync check:** open `http://localhost:5173/?room=demo-room` in two
browser tabs (or two devices on the same network). Draw in one tab — the
stroke should appear in the other within a few hundred ms, both while
drawing (live) and once you lift the pen (committed).

**Room isolation:** open a third tab with a different room, e.g.
`?room=other-room`. It should *not* see strokes from `demo-room` — confirms
rooms are properly scoped.

**Confirm it's actually P2P, not relayed:** open `chrome://webrtc-internals`
(or `about:webrtc` in Firefox) while two tabs are connected. You should see
an active `RTCPeerConnection` with a `data channel` between the two peers.
The signaling server terminal should only log connect/disconnect lines —
never drawing data, since strokes go directly peer-to-peer.

**Reconnection:** close one tab and reopen it with the same room — it
should sync existing strokes from the peer still connected (Yjs replays
the CRDT state on join).

**Backend in isolation:** you can sanity-check the signaling server without
the frontend at all:

```bash
curl -i -N \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  http://localhost:4444/
```

A `101 Switching Protocols` response means the WebSocket upgrade works.

**Type-check the frontend** without running it:

```bash
cd frontend
npx tsc -b
```

There's no automated test suite yet — for now, testing means the manual
checks above.

## Making changes

### Frontend (`frontend/src/`)

- **`Whiteboard.tsx`** — the canvas itself. Drawing logic (pointer handlers),
  what gets rendered (`<Line>` per stroke), and how strokes are represented
  (`Stroke` type) all live here. To change how a stroke looks (color,
  width, tool type), this is the file to edit.
- **`useYjs.ts`** — sets up the shared document and P2P provider for a given
  room. If you need a *new* piece of shared state (e.g. a shape tool, sticky
  notes, cursor positions), get it from `ydoc` here or add it alongside
  `lines` in `Whiteboard.tsx`.
- **How syncing works:** two channels, both provided by Yjs —
  - `ydoc.getArray('lines')` is the CRDT-backed shared array: anything
    pushed to it is durable and replays for peers who join later. Use this
    for anything that should persist for the session (finished strokes).
  - `awareness.setLocalStateField(...)` is ephemeral, per-client state that
    disappears when a peer disconnects. Use this for anything transient
    (in-progress strokes, cursor position, "who's online").
- **Changing the signaling server URL:** set `VITE_SIGNALING_URL` in a
  `frontend/.env` file (defaults to `ws://localhost:4444`).
- **Adding a dependency:** `npm install <package>` from `frontend/`.

### Backend (`backend/app/main.py`)

- The whole server is one WebSocket endpoint implementing a pub/sub
  protocol (`subscribe` / `unsubscribe` / `publish` / `ping`) — this exact
  shape matches the `y-webrtc` signaling protocol, which is what lets the
  frontend's off-the-shelf `y-webrtc` client connect without a custom
  provider. If you change the message shapes here, you'd need a matching
  custom provider on the frontend — usually not worth it.
- This server only ever sees connection-handshake messages (SDP/ICE), not
  whiteboard content, so it's safe to keep stateless and cheap to host.
- **Adding a dependency:** `uv add <package>` from `backend/` (updates
  `pyproject.toml` and `uv.lock` together — don't hand-edit either).
- **Removing a dependency:** `uv remove <package>`.

### Things not built yet

- Google Drive storage/auth (backend has no routes for this yet — only the
  signaling WebSocket exists).
- Persistence across sessions beyond what's live in connected peers' Yjs
  docs — if everyone disconnects, the board's contents are gone. Drive
  storage is meant to solve this.
- `.gitignore` for `.venv/`, `node_modules/`, `dist/` — not yet added.
