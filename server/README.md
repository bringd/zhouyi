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

## Endpoints (planned)

- `POST /api/auth/register` — Task B3
- `POST /api/auth/login` — Task B3
- `POST /api/auth/logout` — Task B3
- `GET  /api/auth/me` — Task B3
- `GET  /api/records` — Task B5
- `POST /api/records` — Task B5
- `DELETE /api/records/:id` — Task B5
- `PATCH /api/records/:id` — Task B5 (notes)

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
