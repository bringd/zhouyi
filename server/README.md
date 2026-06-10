# Zhouyi Server (Backend)

Node.js + Express + TypeScript backend for the 易象阁 website.

## Setup

```bash
cd server
npm install
cp .env.example .env   # then edit
npm run dev            # starts on http://localhost:3001
```

## Scripts

- `npm run dev` — start with hot reload (tsx watch)
- `npm run build` — compile TypeScript to dist/
- `npm start` — run compiled JS
- `npm run typecheck` — TypeScript check
- `npm run db:generate` — generate SQL migration from schema (after schema changes)
- `npm run db:migrate` — apply pending migrations to the database
- `npm run db:push` — push schema directly (dev only — no migration history)
- `npm run db:studio` — open Drizzle Studio at https://local.drizzle.studio

## Database

PostgreSQL 14+ is required.

### Local setup (Docker)

```bash
docker run -d --name zhouyi-pg \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=zhouyi \
  -p 5432:5432 \
  postgres:16
```

### Migrations

```bash
npm run db:generate   # Generate SQL from schema (after schema changes)
npm run db:migrate    # Apply pending migrations to DB
npm run db:push       # Push schema directly (dev only — no migration history)
npm run db:studio     # Open Drizzle Studio at https://local.drizzle.studio
```

### Tables

- `users` — accounts
- `records` — divination history (JSON-rich)
- `favorite_hexagrams` — user-starred hexagrams
- `ai_usage` — daily AI call counter for rate limiting
- `sessions` — refresh tokens (optional)

## Authentication

This MVP identifies users via a server-set **session cookie** (`zhouyi_session`,
`HttpOnly`, `SameSite=Lax`, 1-year max-age). No email/password is required.

- On the first request to any `/api/*` route (except `/api/ai/*`), the
  server generates a UUID session id, creates a *guest user* in the
  `users` table, and writes the cookie back to the client.
- Subsequent requests carry the cookie and resolve to the same user.
- The cookie is `HttpOnly`, so JavaScript on the frontend cannot read
  it directly. The browser sends it automatically when the frontend
  uses `fetch(..., { credentials: 'include' })`.
- When Task B3 (JWT email/password auth) lands, guest accounts can be
  promoted to real accounts and this cookie scheme will coexist with
  JWT issuance.

`/api/ai/*` is rate-limited per **IP** (not per user) and does **not**
require the session cookie.

## Endpoints

### `GET /health`

Health check. Returns 200 if all dependencies are up, 503 if the database is down.

```json
{
  "status": "ok",
  "timestamp": "2026-06-02T08:30:00.000Z",
  "uptime": 12.4,
  "env": "development",
  "checks": { "database": "up" }
}
```

### `POST /api/ai/interpret`

Server-proxied Claude AI interpretation. **Server-Sent Events (SSE) stream.**

Rate limited: **5 calls per IP per day (UTC)**. Override with `AI_DAILY_LIMIT` env var.

**Request body**

```json
{
  "mainHexagramId": 1,
  "changedHexagramId": 2,
  "movingLine": 4,
  "question": "近期是否适合换工作？"
}
```

| Field | Type | Range | Required |
|---|---|---|---|
| `mainHexagramId` | int | 1-64 | yes |
| `changedHexagramId` | int | 1-64 | yes |
| `movingLine` | int | 1-6 | yes |
| `question` | string | ≤500 chars | no |

**Response headers**

- `Content-Type: text/event-stream`
- `X-RateLimit-Limit: 5`
- `X-RateLimit-Remaining: 3` (count after this call)
- `X-RateLimit-Reset: 1717353600` (UTC epoch seconds)

**SSE events**

```text
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"乾卦"}}\n\n
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"提示..."}}\n\n
...
data: {"type":"done","usage":{"inputTokens":150,"outputTokens":350}}\n\n
```

If the upstream Claude call fails, an `error` event is sent before the stream closes.

**Rate limit exceeded (HTTP 429)**

```json
{
  "error": "RateLimitExceeded",
  "message": "今日 AI 解读次数已用完，请明日再试。",
  "limit": 5,
  "resetAt": "2026-06-03T00:00:00.000Z"
}
```

**Service not configured (HTTP 503)**

Returned when `ANTHROPIC_API_KEY` is missing.

### `GET /api/ai/usage`

Check the current IP's rate limit status. Useful for the frontend to display
remaining quota without consuming one.

```json
{
  "limit": 5,
  "remaining": 3,
  "resetAt": "2026-06-03T00:00:00.000Z",
  "current": 1
}
```

### `POST /api/records`

Create a new divination record for the current user (guest or real).
Requires the session cookie — set automatically on first request.

**Request body**

```json
{
  "type": "three-number",
  "question": "近期是否适合换工作？",
  "numbers": [3, 7, 5],
  "region": "Asia/Shanghai",
  "timezone": "Asia/Shanghai",
  "mainHexagramId": 1,
  "movingLine": 4,
  "changedHexagramId": 9,
  "aiInterpretation": "...",
  "userNote": "..."
}
```

| Field | Type | Required |
|---|---|---|
| `type` | `'three-number' \| 'daily'` | yes |
| `mainHexagramId` | int 1-64 | yes |
| `movingLine` | int 1-6 | yes |
| `changedHexagramId` | int 1-64 | yes |
| `question` | string ≤500 | no |
| `numbers` | `[int, int, int]` | no |
| `region`, `timezone` | string ≤100 | no |
| `aiInterpretation` | string ≤10_000 | no |
| `userNote` | string ≤2_000 | no |

Returns `201` with the created record (including `id`, `createdAt`).

### `GET /api/records?limit=50&offset=0`

List the current user's records, newest first.
`limit` is clamped to `[1, 100]` (default 50); `offset` defaults to 0.

```json
{ "records": [...], "limit": 50, "offset": 0 }
```

### `GET /api/records/:id`

Fetch a single record. Returns `404` if it does not exist *or* if it
belongs to another user.

### `PATCH /api/records/:id`

Update the user's personal note on a record. Body: `{ "userNote": "..." }`.

### `DELETE /api/records/:id`

Delete a record. Returns `204` on success, `404` if not found.

### `POST /api/favorites`

Star a hexagram for the current user. Body:
`{ "hexagramId": 1, "note"?: "..." }`.
Returns `409 AlreadyFavorited` if the user has already starred that hexagram.

### `GET /api/favorites`

List the current user's favorites, newest first.

### `DELETE /api/favorites/:hexagramId`

Unstar a hexagram. `:hexagramId` must be an integer 1-64.

## Endpoints (planned)

- `POST /api/auth/register` — Task B3
- `POST /api/auth/login` — Task B3
- `POST /api/auth/logout` — Task B3
- `GET  /api/auth/me` — Task B3

## Environment variables

| Var | Required | Default | Purpose |
|---|---|---|---|
| NODE_ENV | no | development | runtime mode |
| PORT | no | 3001 | server port |
| FRONTEND_ORIGIN | no | http://localhost:5173 | CORS allowed origin |
| DATABASE_URL | yes (B2) | — | PostgreSQL connection string |
| JWT_SECRET | no (B3) | dev value | signing secret for JWTs |
| **ANTHROPIC_API_KEY** | **yes (B4)** | — | Claude API key (server-side) |
| AI_DAILY_LIMIT | no | 5 | Per-IP daily AI interpretation cap |
| HEXAGRAMS_JSON_PATH | no | auto-detect | Override path to `hexagrams.json` |
