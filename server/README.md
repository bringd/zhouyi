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
