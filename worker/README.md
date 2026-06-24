# @zhouyi/worker — Cloudflare Workers backend

Hono + D1 (SQLite) backend for the 易象阁 community feed. Replaces
the previous Express + Postgres server in `../server/`, which is now
kept for reference only.

## Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/health` | — | Liveness check (no DB hit) |
| GET  | `/api/feed` | session | Paginated list of shared posts (newest first) |
| POST | `/api/feed` | session | Publish a new post |
| GET  | `/api/feed/:id` | session | One post + its replies (joined with author nicknames) |
| POST | `/api/feed/:id/replies` | session | Add a reply (auto-increments `reply_count`) |
| GET  | `/api/records` | session | List the current user's divination history |
| POST | `/api/records` | session | Create a record |
| GET  | `/api/records/:id` | session | One record (must belong to caller) |
| PATCH | `/api/records/:id` | session | Update `userNote` |
| DELETE | `/api/records/:id` | session | Delete |
| GET  | `/api/favorites` | session | List favorites |
| POST | `/api/favorites` | session | Add favorite (409 on duplicate) |
| DELETE | `/api/favorites/:hexagramId` | session | Remove favorite |
| POST | `/api/ai/interpret` | session | BYOK stub — always returns 503 (use frontend BYOK) |

## Data model (D1 / SQLite)

- `users` — guest users, keyed by session UUID. Holds `nickname`,
  passive observation fields.
- `sessions` — session id → user id mapping.
- `records` — divination history (caller-scoped).
- `favorite_hexagrams` — per-user favorites.
- `ai_usage` — date-bucketed AI call counter (for future rate limits).
- `shared_posts` — community feed: denormalized divination
  results + `note` + `reply_count` + `createdAt`.
- `shared_replies` — replies on `shared_posts`. Stores raw
  `content`; author info joined at query time.

## Local development

```bash
cd worker
npm install
# Create D1 (one-time)
npx wrangler d1 create zhouyi-db
# → paste the database_id into wrangler.toml
npx wrangler d1 migrations apply zhouyi-db --local
npm run dev          # starts Wrangler on http://localhost:8787
```

The frontend dev server (Vite) is configured to call the Worker at
the URL printed by `wrangler dev`. The Vite dev proxy in
`vite.config.ts` already routes `/api-proxy/*` to that origin.

## Deploy

```bash
# Create D1 on the remote account
npx wrangler d1 create zhouyi-db
npx wrangler d1 migrations apply zhouyi-db --remote
npm run deploy
```

After the first deploy, the Worker URL is `https://zhouyi-worker.<account>.workers.dev`. Add it to the Pages frontend as an env var, or hard-code in `apiConfig.ts`.

## CORS

The Worker allows `Access-Control-Allow-Origin` from `FRONTEND_ORIGIN`
(env var, set per environment in `wrangler.toml`). The frontend must
send `credentials: 'include'` so the session cookie is sent on
cross-origin requests.

## Why the AI route is a stub

The site uses **BYOK (Bring Your Own Key)** — the browser calls
Anthropic directly with the user's key. The backend route returns
503 to make the "AI 解读功能暂未上线" UI work. If you later
re-introduce a server-side AI proxy, replace the stub handler in
`src/routes/ai.ts` with the real streaming implementation.
