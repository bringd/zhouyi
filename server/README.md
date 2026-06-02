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

## Endpoints (current)

- `GET /health` — health check

## Endpoints (planned)

- `POST /api/auth/register` — Task B3
- `POST /api/auth/login` — Task B3
- `POST /api/auth/logout` — Task B3
- `GET  /api/auth/me` — Task B3
- `POST /api/ai/interpret` — Task B4 (server-proxied Claude call)
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
| DATABASE_URL | no (B2) | — | PostgreSQL connection string |
| JWT_SECRET | no (B3) | dev value | signing secret for JWTs |
| ANTHROPIC_API_KEY | no (B4) | — | Claude API key (server-side) |
