# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Piano Conservatory — a multi-pianist online video practice app with cartoon-style practice rooms, WebRTC peer-to-peer video, user authentication, personal dashboards, session tracking, and daily leaderboards.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL (raw `pool.query` — Drizzle ORM installed but schema.ts is empty)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **WebSockets**: `ws` library (signaling server for WebRTC)
- **WebRTC**: Native browser RTCPeerConnection
- **Frontend**: React + Vite, Tailwind CSS v4, Framer Motion
- **Auth**: JWT in httpOnly cookies (`bcryptjs` + `jsonwebtoken`)

## Features

- Cartoon conservatory building with a grid of practice rooms (max 9 per room)
- WebRTC peer-to-peer video/audio via a WebSocket signaling server
- Mute/unmute microphone, toggle camera on/off
- 16 cartoon animal/character avatars
- **Piano lid toggle**: open lid = recording practice time; close lid = session ends
- Sessions under 1 minute auto-deleted on lid-close
- **Full auth system**: signup, login, logout, forgot-password, reset-password
- **Personal dashboard**: view today's sessions, practice history by day, total stats, streak counter, manual session logging
- **Daily leaderboard per room**: top 10 practitioners today, auto-refreshes every 30s
- **Session history**: home page shows recent sessions linked to rooms

## DB Schema

### `users` table
- `id` SERIAL PK, `email` TEXT UNIQUE, `password_hash`, `display_name`, `avatar_index`, `created_at`, `reset_token`, `reset_token_expires`

### `sessions` table
- `id` SERIAL PK, `peer_id`, `display_name`, `room_id`, `joined_at`, `left_at`, `duration_seconds`
- `user_id` FK → users (nullable for anonymous), `notes`, `session_date` DATE, `is_manual` BOOL
- Auto-deleted if duration < 60 seconds

### `daily_leaderboard` view
- Aggregates `total_seconds` and `session_count` per `display_name` per `room_id` per `session_date`

## Key API Endpoints

### Auth
- `POST /api/auth/signup` — create account, set JWT cookie
- `POST /api/auth/login` — verify password, set JWT cookie
- `POST /api/auth/logout` — clear cookie
- `GET /api/auth/me` — return current user (requires auth cookie)
- `POST /api/auth/forgot-password` — return reset token (no email — shown in UI for dev)
- `POST /api/auth/reset-password` — update password using token

### Dashboard (requires auth cookie)
- `GET /api/dashboard/sessions?date=YYYY-MM-DD` — user's sessions for a day + daily stats
- `POST /api/dashboard/sessions` — manually add a session
- `DELETE /api/dashboard/sessions/:id` — delete a session
- `GET /api/dashboard/summary` — today count/seconds, all-time count/seconds, streak

### Sessions & Leaderboard
- `POST /api/sessions/start` — start a lid-open session (attaches user_id if logged in)
- `POST /api/sessions/end` — end session + auto-delete if < 60s
- `GET /api/leaderboard/:roomId` — today's top 10 by total practice time

## Frontend Routes

- `/` — Home (join/create room; shows auth state)
- `/login` — Login page
- `/signup` — Signup page (with avatar picker)
- `/forgot-password` — Forgot password
- `/reset-password?token=...` — Reset password
- `/dashboard` — Personal dashboard (protected; redirects to /login if not authed)
- `/room/:roomId` — Live practice room with video, piano lid, leaderboard

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/
│   │   └── src/
│   │       ├── middleware/auth.ts       # JWT middleware + helpers
│   │       ├── routes/auth.ts           # Auth endpoints
│   │       ├── routes/dashboard.ts      # Dashboard endpoints
│   │       ├── routes/sessions.ts       # Sessions + leaderboard
│   │       └── signaling.ts             # WebSocket signaling
│   └── piano-conservatory/
│       └── src/
│           ├── hooks/use-auth.ts        # Auth context + useAuth hook
│           ├── hooks/use-webrtc-room.ts # WebRTC hook
│           ├── components/RoomCell.tsx  # Practice room cell + piano SVG
│           ├── components/Leaderboard.tsx
│           ├── pages/home.tsx
│           ├── pages/login.tsx
│           ├── pages/signup.tsx
│           ├── pages/forgot-password.tsx
│           ├── pages/reset-password.tsx
│           ├── pages/dashboard.tsx
│           └── pages/room.tsx
├── lib/db/                              # Drizzle ORM setup (pool exported)
└── ...
```

## Auth Cookie Notes

- Cookie name: `piano_auth`, httpOnly, sameSite: lax, 30-day expiry
- Vite dev proxy forwards `/api` → `localhost:8080` with `changeOrigin: true`
- `credentials: "include"` required on all fetch calls to `/api`

## TypeScript & Composite Projects

- `lib/*` packages are composite, emit declarations via `tsc --build`
- `artifacts/*` are leaf packages checked with `tsc --noEmit`
- Root `tsconfig.json` is a solution file for libs only

## Root Scripts

- `pnpm run build` — runs typecheck then recursively runs build in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references
