# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project: 易象阁 (Orix Studio) — 64-卦 周易研究网站

A 周易 (I Ching) study site with: 64-卦图鉴 (codex), 今日卦境 (daily hexagram), 三数起卦 (three-number divination), Codex-powered AI interpretation, and a community 卦册 (shared feed). Visual style: 国风动漫 / 工笔重彩 + 现代极简. See `docs/superpowers/specs/2026-06-02-zhouyi-website-design.md` for the full product spec.

## Common commands

Monorepo with **three** `package.json`s: root (frontend), `server/` (legacy Express, **not actively deployed**), `worker/` (current Cloudflare Worker). Install root + the one you're actively editing.

```bash
# Frontend dev (http://localhost:5173)
npm install
npm run dev

# Worker dev (local D1 via miniflare)
cd worker && npm install
npm run dev          # wrangler dev, served on http://localhost:8787

# Build frontend — runs `build:sitemap` prebuild + `copy-functions` postbuild
npm run build

# Verify
npm test                       # Vitest (frontend, tests/ + tests/lib/ + tests/components/)
npm run test:watch
npm run typecheck              # tsc -b (root)
cd worker && npm run typecheck
npm run lint
```

Run a single test file: `npx vitest run tests/lib/divination.test.ts`
Run tests by name: `npx vitest run -t "daily hexagram"`

Worker D1 migrations: `cd worker && npx wrangler d1 migrations apply zhouyi-db --local` (dev) or `--remote` (prod).

## Architecture overview

```
┌─────────────────────────────┐        browser-direct (BYOK)       ┌──────────────────┐
│  Vite + React SPA           │ ────── x-api-key: sk-... ────────▶ │  Anthropic API   │
│  src/                       │   (when user supplies their own    │  api.anthropic   │
│  - 64 卦 as JSON            │    key in Settings; no backend)    │  .com            │
│  - lib/ (pure, TDD)         │                                    └──────────────────┘
│  - localStorage             │
│  - SSE parser for legacy    │   when no key, hits same-origin proxy:
│    /api/ai paths            │        ┌─────────────────────────────────────────────┐
└──────────┬──────────────────┘        │ Cloudflare Pages Function (functions/)      │
           │  same-origin fetch        │ POST /api/proxy/anthropic/v1/messages     │
           │  /api/feed /api/records   │  - BYOK: forward x-api-key as-is          │
           │  /api/favorites           │  - demo: inject AI_DEMO_KEY + count quota │
           ▼                           │    against D1 `ai_usage` table             │
┌─────────────────────────────┐        └──────────────┬──────────────────────────────┘
│  Cloudflare Worker          │                       │
│  (worker/)                  │  ◀──── D1 (zhouyi-db)
│  Hono + Drizzle             │         shared by Worker + Pages Function
│  - feed / records /         │
│    favorites / health       │
└─────────────────────────────┘
```

**Deployment topology:** frontend SPA on Cloudflare Pages (`orix-studio.pages.dev`); community backend on a separate Cloudflare Worker (`zhouyi-worker.bringd.workers.dev`). Pages Functions live alongside the Pages project — they are **not** the same as the Worker.

### Frontend (`src/`)

| Path | Purpose |
|---|---|
| `main.tsx`, `App.tsx` | Entry + lazy-loaded route table |
| `data/` | **Static source of truth** for 64 卦 (`hexagrams.json`, `trigrams.json`, `relationships.json`). Both frontend (TS import) and the Worker (read at boot) consume it — there is no DB copy |
| `lib/divination.ts` | `divination(a, b, c)`, `flipLine`, `binaryCodeToHexagramId`. Binary code is **bottom-to-top** (`binary[0]` = line 1, 1 = yang) |
| `lib/daily.ts` | `getDailyHexagram(date, timezone)` — djb2 hash of `YYYY-MM-DD` (rendered in the IANA zone via `Intl.DateTimeFormat`); seed → `(seed%64)+1` for hexagram id, `(seed/64 % 6)+1` for moving line |
| `lib/relations.ts` | Pure: 错卦 (flip all 6 bits) / 综卦 (reverse) / 互卦 (nuclear — lower=lines 2,3,4; upper=lines 3,4,5) |
| `lib/ai.ts` | **Browser-direct** to Anthropic `/v1/messages` (BYOK), with SSE parsing and a stable `AIError.code` the UI switches on (`no-api-key`, `unauthorized`, `rate-limit`, `content-filtered`, `quota-exceeded`, …) |
| `lib/apiConfig.ts` | Per-user config (baseUrl, apiKey, model). Reads localStorage; migrates old baseUrls. **In production the default baseUrl is the same-origin Pages Function proxy**, not api.anthropic.com |
| `lib/storage.ts` | Defensive `localStorage` wrapper for `UserRecord[]` and `UserSettings`. Caps at `MAX_RECORDS = 200` |
| `components/hexagram/` | Yao-line rendering (YaoLineStack, YaoLineScroll, HexagramGlyph, TwinSpread, HexagramCard) |
| `components/{layout,motion,sections,ui}/` | Header/Footer/PageLayout, BreathEffect/FlipEntry, DailyHero/CodexGrid/DivinationForm/ResultDisplay, Button/Card/Seal/NumberBox/PageTitle |
| `pages/` | Lazy-loaded route components — `App.tsx` wires all 8 routes (Home, Codex, HexagramDetail, Divination, Result, Records, Feed, Settings) |
| `styles/tokens.css` | CSS variables for the 矿物质色 palette (june-red/gold/bronze/jade/clay) and 3 font families |

**Path alias**: `@/*` → `src/*` (configured in `tsconfig.json` and `vite.config.ts`).

### Worker backend (`worker/src/`) — community / persistence

Hono app on Cloudflare Workers + D1 (SQLite). The Worker is what the frontend talks to for `/api/feed`, `/api/records`, `/api/favorites`, `/api/health`. **It does not proxy the AI call** — that's done by the Pages Function (next section).

| Path | Purpose |
|---|---|
| `index.ts` | Hono app + D1 binding wiring + CORS (comma-separated `FRONTEND_ORIGIN`, no `*`+credentials) |
| `db/schema.ts` | Drizzle tables for `users`, `records`, `favorite_hexagrams`, `ai_usage` (used by the proxy too), `shared_posts`, `shared_replies`, `sessions` |
| `lib/hexagramData.ts` | Reads `src/data/hexagrams.json` from disk via wrangler's asset binding (2 candidate paths; env override `HEXAGRAMS_JSON_PATH`) |
| `middleware/session.ts` | `zhouyi_session` cookie (`HttpOnly`, `SameSite=Lax`, 1y). Augments `c.var.userId` / `c.var.sessionId` |
| `routes/feed.ts` | `GET /api/feed` list + `POST /api/feed` publish (with optional `nickname` from user Settings) |
| `routes/records.ts`, `routes/favorites.ts` | CRUD for divination history + starred hexagrams |
| `routes/health.ts` | Liveness + DB up/down |
| `routes/ai.ts` | Legacy endpoint kept for compatibility; the live path is the Pages Function proxy |
| `migrations/` | `*.sql` applied via `wrangler d1 migrations apply zhouyi-db` |

### Pages Functions (`functions/`) — AI proxy + demo quota

`functions/api/proxy/anthropic/v1/messages.ts` is a **same-origin reverse proxy** that bypasses browser CORS so the SPA can call Anthropic from `https://orix-studio.pages.dev` without preflight failures. It runs two modes based on the request:

- **BYOK** (`x-api-key` header present): forwards the key unchanged to Anthropic, no quota.
- **Demo** (no `x-api-key`): injects `env.AI_DEMO_KEY`, counts the call against the per-IP daily quota (`AI_DEMO_DAILY_LIMIT`, default 5/UTC day) via the shared D1 `ai_usage` table. Over-quota → 429 + `Retry-After: 86400`.

Always sets `X-AI-Mode`, `X-AI-Quota-Limit/Used/Remaining` response headers so the frontend can render "已用 N/5" banners.

**Critical routing constraint:** Pages Functions do NOT support dynamic `[...slug]` / `[[slug]]` file names. Use exact-path files like `functions/api/proxy/anthropic/v1/messages.ts`. Cloudflare Pages will silently 404 dynamic-segment files.

**Critical deploy constraint:** Functions in `functions/` are NOT auto-copied into `dist/` by Vite. `scripts/copy-functions.mjs` runs as a `build` post-step to mirror them. Without it, deployed Pages has no Functions and the proxy returns 404.

**D1 binding:** the proxy reads/writes `ai_usage`. The binding **must be added in the Cloudflare dashboard** (`Pages → orix-studio → Settings → Functions → D1 database bindings → Variable name: DB → Database: zhouyi-db`) — `wrangler.toml.example` alone is not enough for the GitHub-App auto-deploy path.

### Legacy backend (`server/`) — DEPRECATED

Express + Drizzle + Postgres. Still in tree but **not deployed**; development moved to `worker/`. Don't add new routes here. If you need to reference it, see git history before `b9f1982`.

## Conventions

- **TDD for `lib/`**: every pure helper has a Vitest spec in `tests/lib/`. Run `npx vitest run tests/lib/<file>.test.ts` while iterating.
- **No `src/store/`** at the time of writing — frontend state is component-local. Zustand is in deps for when cross-page state is needed.
- **Test setup** (`tests/setup.ts`) mocks `matchMedia`, `IntersectionObserver`, `ResizeObserver`, and polyfills `ReadableStream`/`TextEncoder`/`TextDecoder` for jsdom. `@testing-library/react` `cleanup` runs in `afterEach`.
- **SSE contract**: server sends `data: {...}\n\n` events. Frontend splits on `\n\n`, parses JSON, looks for `type` field. Don't change the event shape without updating both the producer and `lib/ai.ts`.
- **Hexagram binary code** is always 6 chars, **bottom-to-top** (`binary[0]` = line 1 / bottom line). 1 = yang, 0 = yin. This convention is used in `flipLine`, `flipAll` (错卦), `reverseAll` (综卦), and `buildNuclearBinary` (互卦).
- **Worker + server files** use `module: "ESNext"` + `.js` import suffixes (`from './app.js'`). New files in those packages must follow this convention. The Pages Function in `functions/` is plain TypeScript with no build step — Cloudflare transpiles it.
- **CORS**: the `FRONTEND_ORIGIN` env var accepts a comma-separated list. Do not set `origin: '*'` with `credentials: true` — it's a browser-forbidden combo.
- **AI keys**: never commit a live key. For local testing, put it in `server/.env` (legacy) or `worker/.dev.vars` / Cloudflare dashboard secrets (current). The Pages Function's `AI_DEMO_KEY` secret is set via `wrangler pages secret put AI_DEMO_KEY --project-name=orix-studio` and via the dashboard. Don't pipe live keys through Bash prompts where the classifier might flag them.
- **Deployment**: `wrangler.toml.example` (don't rename to `wrangler.toml` — that triggers the Workers deploy path, not Pages). Pages builds via the Cloudflare GitHub App from `main` branch; `fly.toml` is leftover from the old Express era. The `prebuild` hook runs `scripts/generate-sitemap.mjs`; the `build` post-step runs `scripts/copy-functions.mjs`.

## Things to know before editing

- The `YaoDesignCompare.tsx` page and many `scripts/shot-*.mjs` / `check-*.mjs` files are visual / acceptance test tooling — not production code. Don't refactor them when touching the app.
- `scripts/fill-yao-batch{1..8}.mjs` and `scripts/fill-modern-interpretations.mjs` are one-shot data-fill scripts for `hexagrams.json`. They are not part of the build pipeline.
- The user prefers **CSS+SVG mockups** rendered for any A/B/C/D option (see `user-preference-visual-samples.md` in memory) — generate them rather than describing in text.
- The `docs/mockups/` directory and `.superpowers/brainstorm/*/content/*.html` are decision artifacts from earlier brainstorming; do not delete.
- The `docs/deploy/{cloudflare-pages.md,fly-io.md}` guides are partially stale: cloudflare-pages.md still describes the old "Pages proxies to Fly.io backend" model — the actual deployed topology is Pages → Worker (same provider). Read them for env-var / dashboard UI references; ignore the architecture diagrams.
- CodeGraph is **not** initialized in this project (`codegraph_status` returns "not initialized"). If you want to use it, run `codegraph init -i` first.
- When debugging "the seal is clipped / the icon overlaps / stacking looks wrong": check **DOM source order** in the parent `relative` wrapper, not just the inner element's `top`/`right`. A later sibling paints on top of an earlier one when both share a stacking context with `z-index: auto`. Use `z-10` + `pointer-events-none` on overlays for self-documenting intent.