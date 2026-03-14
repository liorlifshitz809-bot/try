# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Piano Conservatory — a multi-pianist online video practice app with cartoon-style practice rooms, WebRTC peer-to-peer video, and a playful conservatory UI.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **WebSockets**: `ws` library (signaling server for WebRTC)
- **WebRTC**: Native browser RTCPeerConnection (no dependencies)
- **Frontend**: React + Vite, Tailwind CSS v4, Framer Motion

## Features

- Cartoon conservatory building with a grid of practice rooms
- Each room shows a pianist avatar + live webcam video in a circular frame
- WebRTC peer-to-peer video/audio via a WebSocket signaling server
- Mute/unmute microphone, toggle camera on/off
- Share room via a link (shareable URL)
- Playful humorous UI: sleeping cat in empty rooms, 🤫 mute badge, room number plates
- 8 cartoon animal/character avatars to choose from

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server + WebSocket signaling
│   └── piano-conservatory/ # React + Vite frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Key Files

- `artifacts/api-server/src/signaling.ts` — WebSocket signaling server for WebRTC
- `artifacts/api-server/src/routes/rooms.ts` — REST API for room creation/lookup
- `artifacts/piano-conservatory/src/hooks/use-webrtc-room.ts` — WebRTC room hook (native RTCPeerConnection)
- `artifacts/piano-conservatory/src/components/RoomCell.tsx` — Individual practice room component
- `artifacts/piano-conservatory/src/pages/home.tsx` — Landing/join page
- `artifacts/piano-conservatory/src/pages/room.tsx` — Main conservatory room view

## WebRTC Signaling Flow

1. User enters name + picks avatar on landing page → POSTs to `/api/rooms` to create a room OR enters a room code to join
2. On joining, frontend connects to WebSocket at `/ws`
3. WebSocket server broadcasts `peer-joined` / `peer-left` events
4. When a new peer joins, existing peers send SDP offers; new peer answers
5. ICE candidates exchanged through the WS server
6. Video streams flow peer-to-peer via RTCPeerConnection

## TypeScript & Composite Projects

- `lib/*` packages are composite, emit declarations via `tsc --build`
- `artifacts/*` are leaf packages checked with `tsc --noEmit`
- Root `tsconfig.json` is a solution file for libs only

## Root Scripts

- `pnpm run build` — runs typecheck then recursively runs build in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server with WebSocket signaling. Routes in `src/routes/`, signaling logic in `src/signaling.ts`.

- Entry: `src/index.ts` — creates HTTP server + WebSocketServer, starts listening
- WebSocket path: `/ws`
- API routes mounted at `/api`
- Room REST API: `POST /api/rooms`, `GET /api/rooms/:roomId`

### `artifacts/piano-conservatory` (`@workspace/piano-conservatory`)

React + Vite frontend. Cartoon conservatory UI with WebRTC video.

- `src/hooks/use-webrtc-room.ts` — core WebRTC + WebSocket logic
- `src/components/RoomCell.tsx` — renders a single practice room
- `src/pages/home.tsx` — join/create room landing page
- `src/pages/room.tsx` — the main room with grid of participants
- `public/images/` — AI-generated avatar images + piano + sleeping cat

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. No custom schema tables yet (rooms are in-memory in the signaling server).

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec for room management API. Run codegen: `pnpm --filter @workspace/api-spec run codegen`
