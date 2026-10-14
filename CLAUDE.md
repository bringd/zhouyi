# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: 易象阁 (Orix Studio) — 64-卦 周易研究网站

A 周易 (I Ching) study site with: 64-卦图鉴 (codex), 今日卦境 (daily hexagram), 三数起卦 (three-number divination), Claude-powered AI interpretation, and a community 卦册 (shared feed). Visual style: 国风动漫 / 工笔重彩 + 现代极简. See `docs/superpowers/specs/2026-06-02-zhouyi-website-design.md` for the full product spec.

## Common commands

Monorepo with **three** `package.json`s: root (frontend), `server/` (**DEPRECATED** legacy Express, in tree but not deployed — do not add new routes), `worker/` (current Cloudflare Worker + D1 backend). Install root + whichever backend you're editing. (An earlier plan to delete `server/` and migrate to pnpm workspaces was archived at `docs/archive/2026-08-15/repo-restructure.md`; not executed.)

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

### Local dev is 3 processes (not 2)

The frontend (Vite), the Worker, and the Pages Functions are three separate runtimes. They must run in parallel; each binds a different port and talks to the others via configured proxies.

```bash
# Terminal 1 — Pages Function (serves dist/ + AI proxy + reads .dev.vars)
cd D:/eight
npm run build                     # build first; T1 serves dist/
npx wrangler pages dev dist --compatibility-date=2025-04-01 --d1=DB=zhouyi-db
#  → http://localhost:8788

# Terminal 2 — Worker (auth/records/favorites/feed routes)
cd D:/eight/worker
npm run dev                       # wrangler dev, :8787

# Terminal 3 — Vite frontend
cd D:/eight
npm run dev                       # :5173 (Vite proxies /api/* → :8787 or :8788 per vite.config.ts)
```

**Three dev-time footguns** (each has cost me hours):

1. **`.dev.vars` location gotcha** — `wrangler pages dev` reads from the **project root** `.dev.vars` (not `worker/.dev.vars` which is for the Worker). For local dev that exercises both runtimes, put the same `AI_DEMO_KEY=...` line in both files. Both are gitignored. Production equivalent is `wrangler pages secret put AI_DEMO_KEY --project-name=orix-studio`.
2. **Wrangler reads `.dev.vars` once at startup** — edit-then-test won't pick up the new value. Restart the relevant process.
3. **`npm run build` will fail without the tsconfig exclude** — root `tsconfig.json` must include `"exclude": ["tests/worker", "worker"]` (already set). Without it, `tsc -b` fails on missing wrangler/hono/drizzle types from `tests/worker/*` and `dist/` becomes stale.

Vite proxy map (from `vite.config.ts`): `/api-feed` → :8787, `/api/auth|/api/records|/api/favorites` → :8787, `/api/proxy/anthropic/*` → :8788.

## Architecture overview

```
┌─────────────────────────────┐   same-origin fetch  ┌──────────────────────────────┐
│  Vite + React SPA           │ ──────────────────▶ │ Cloudflare Pages Functions   │
│  src/                       │   /api/auth, /api/   │ functions/api/proxy/         │
│  - 64 卦 as JSON            │   records, /api/     │   anthropic/v1/messages.ts   │
│  - lib/ (pure, TDD)         │   favorites, /api/   │                              │
│  - localStorage             │   feed, /api/proxy/  │ 1. Browser sends x-api-key?  │
│  - 9 lazy-loaded routes     │   anthropic/*        │    → forward as-is (BYOK)    │
│    (Home, Codex, Hexagram   │                      │ 2. No header?                │
│    Detail, Divination,      │                      │    → inject env.AI_DEMO_KEY  │
│    Result, Records, Feed,   │                      │    → count per-IP quota in   │
│    Settings + NotFound +    │                      │      D1 ai_usage table        │
│    YaoDesignCompare)        │                      │                              │
│  - Guest / registered mode  │                      │ Default upstream:             │
│    via SmsModal + zhouyi_   │                      │   https://api.minimaxi.com/  │
│    session cookie           │                      │   anthropic/v1/messages      │
└──────────┬──────────────────┘                      │   (model: minimax-m3)        │
           │  same-origin fetch                      └──────────────┬───────────────┘
           ▼  /api/feed, /api/records, /api/favorites, /api/auth       │
┌─────────────────────────────┐                                     │
│  Cloudflare Worker          │  ◀──── D1 (zhouyi-db, shared)
│  (worker/)                  │         with Pages Function
│  Hono + Drizzle             │
│  - feed / records /         │
│    favorites / auth / health│
└─────────────────────────────┘
```

**Phase 1 default (current): BYOK UI is hidden** in `src/pages/Settings.tsx` (wrapped in `{false && …}`). All visitors — guests (1 free divination) and SMS-registered users — use the server-side `AI_DEMO_KEY` injected by the Pages Function. The early `if (!config.apiKey) throw` was removed from `src/lib/ai.ts` so the request reaches the proxy. Restore the BYOK check if you re-enable the Settings UI.

**Deployment topology:** frontend SPA on Cloudflare Pages (`orix-studio.pages.dev`); community/SMS backend on a separate Cloudflare Worker (`zhouyi-worker.bringd.workers.dev`). Pages Functions live alongside the Pages project — they are **not** the same as the Worker.

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

### Worker backend (`worker/src/`) — community / persistence + SMS auth

Hono app on Cloudflare Workers + D1 (SQLite). The Worker is what the frontend talks to for `/api/feed`, `/api/records`, `/api/favorites`, `/api/auth/*`, `/api/health`. **It does not proxy the AI call** — that's done by the Pages Function (next section).

| Path | Purpose |
|---|---|
| `index.ts` | Hono app + D1 binding wiring + CORS (comma-separated `FRONTEND_ORIGIN`, no `*`+credentials) |
| `db/schema.ts` | Drizzle tables for `users`, `records`, `favorite_hexagrams`, `ai_usage` (used by the proxy too), `shared_posts`, `shared_replies`, `sessions` |
| `lib/hexagramData.ts` | Reads `src/data/hexagrams.json` from disk via wrangler's asset binding (2 candidate paths; env override `HEXAGRAMS_JSON_PATH`) |
| `middleware/session.ts` | `zhouyi_session` cookie (`HttpOnly`, `SameSite=Lax`, 1y). Augments `c.var.userId` / `c.var.sessionId` + `c.var.mode` (`'guest' \| 'registered'`) + `c.var.remaining` (number \| null) |
| `routes/feed.ts` | `GET /api/feed` list + `POST /api/feed` publish (with optional `nickname` from user Settings) |
| `routes/records.ts`, `routes/favorites.ts` | CRUD for divination history + starred hexagrams; `records` POST also enforces `c.var.remaining === 0 → 402 quota_exceeded` |
| `routes/auth.ts` | `POST /api/auth/sms/send` (validates `^1[3-9]\d{9}$`, 60s cooldown, 5/h, MOCK `console.log('[SMS] code=…')`) + `POST /api/auth/sms/verify` (6-digit, 5 attempts → 1h lock, re-points session if `users.email` already taken) |
| `routes/me.ts` | `GET /api/auth/me` → `{ userId, mode, remaining }` |
| `routes/health.ts` | Liveness + DB up/down |
| `routes/ai.ts` | Legacy 503 stub kept for compatibility; the live path is the Pages Function proxy |
| `migrations/` | `*.sql` applied via `wrangler d1 migrations apply zhouyi-db`. **0002 adds** `sms_phone`, `sms_code`, `sms_expires_at`, `sms_verify_attempts`, `sms_locked_until` to `sessions` |

### Pages Functions (`functions/`) — AI proxy + demo quota

`functions/api/proxy/anthropic/v1/messages.ts` is a **same-origin reverse proxy** that bypasses browser CORS so the SPA can call Anthropic from `https://orix-studio.pages.dev` without preflight failures. It runs two modes based on the request:

- **BYOK** (`x-api-key` header present): forwards the key unchanged to Anthropic, no quota.
- **Demo** (no `x-api-key`): injects `env.AI_DEMO_KEY`, counts the call against the per-IP daily quota (`AI_DEMO_DAILY_LIMIT`, default 5/UTC day) via the shared D1 `ai_usage` table. Over-quota → 429 + `Retry-After: 86400`.

Always sets `X-AI-Mode`, `X-AI-Quota-Limit/Used/Remaining` response headers so the frontend can render "已用 N/5" banners.

**Critical routing constraint:** Pages Functions do NOT support dynamic `[...slug]` / `[[slug]]` file names. Use exact-path files like `functions/api/proxy/anthropic/v1/messages.ts`. Cloudflare Pages will silently 404 dynamic-segment files.

**Critical deploy constraint:** Functions in `functions/` are NOT auto-copied into `dist/` by Vite. `scripts/copy-functions.mjs` runs as a `build` post-step to mirror them. Without it, deployed Pages has no Functions and the proxy returns 404.

**D1 binding:** the proxy reads/writes `ai_usage`. The binding **must be added in the Cloudflare dashboard** (`Pages → orix-studio → Settings → Functions → D1 database bindings → Variable name: DB → Database: zhouyi-db`) — `wrangler.toml.example` alone is not enough for the GitHub-App auto-deploy path.

### Legacy backend (`server/`) — DEPRECATED, in tree

Express + Drizzle + Postgres. **Not deployed.** Do not add new routes here — the live community backend is `worker/`. For historical reference, see `docs/archive/2026-08-15/repo-restructure.md` (the plan that proposed deleting `server/` and migrating to pnpm workspaces; it was not applied and the project remains on npm + monorepo-as-is).

## Conventions

- **TDD for `lib/`**: every pure helper has a Vitest spec in `tests/lib/`. Run `npx vitest run tests/lib/<file>.test.ts` while iterating. Worker tests live in `tests/worker/` and run with `npm --prefix worker test` (they need a vitest-pool-workers D1 binding, see `worker/vitest.config.ts`).
- **No `src/store/`** at the time of writing — frontend state is component-local. Zustand is in deps for when cross-page state is needed.
- **Test setup** (`tests/setup.ts`) mocks `matchMedia`, `IntersectionObserver`, `ResizeObserver`, and polyfills `ReadableStream`/`TextEncoder`/`TextDecoder` for jsdom. `@testing-library/react` `cleanup` runs in `afterEach`.
- **SSE contract**: server sends `data: {...}\n\n` events. Frontend splits on `\n\n`, parses JSON, looks for `type` field. Don't change the event shape without updating both the producer and `lib/ai.ts`.
- **Hexagram binary code** is always 6 chars, **bottom-to-top** (`binary[0]` = line 1 / bottom line). 1 = yang, 0 = yin. This convention is used in `flipLine`, `flipAll` (错卦), `reverseAll` (综卦), and `buildNuclearBinary` (互卦).
- **Worker files** use `module: "ESNext"` + `.js` import suffixes (`from './app.js'`). New files in `worker/src/` must follow this convention. The Pages Function in `functions/` is plain TypeScript with no build step — Cloudflare transpiles it.
- **CORS**: the `FRONTEND_ORIGIN` env var accepts a comma-separated list. Do not set `origin: '*'` with `credentials: true` — it's a browser-forbidden combo.
- **AI keys**: never commit a live key. For local testing, put it in `worker/.dev.vars` (Worker) and root `.dev.vars` (Pages Function reads from project root) or use Cloudflare dashboard secrets. The Pages Function's `AI_DEMO_KEY` secret is set via `wrangler pages secret put AI_DEMO_KEY --project-name=orix-studio` and via the dashboard. Don't pipe live keys through Bash prompts where the classifier might flag them.
- **Deployment**: `wrangler.toml.example` (don't rename to `wrangler.toml` — that triggers the Workers deploy path, not Pages). Pages builds via the Cloudflare GitHub App from `main` branch. The `prebuild` hook runs `scripts/generate-sitemap.mjs`; the `build` post-step runs `scripts/copy-functions.mjs`.
- **Auth + quota model (Phase 1)**: guests get **1 free divination** (frontend gate via `src/lib/quota.ts` + backend gate via `c.var.remaining === 0 → 402`). SMS registration upgrades to `registered` and unlocks unlimited use. MOCK SMS code is printed to the **Worker** terminal (`:8787`), not the Pages Function terminal — see `docs/superpowers/specs/2026-07-24-user-registration-and-default-api-key-design.md` for the full design.

## Things to know before editing

- The `YaoDesignCompare.tsx` page and many `scripts/shot-*.mjs` / `check-*.mjs` files are visual / acceptance test tooling — not production code. Don't refactor them when touching the app.
- `scripts/fill-yao-batch{1..8}.mjs` and `scripts/fill-modern-interpretations.mjs` are one-shot data-fill scripts for `hexagrams.json`. They are not part of the build pipeline.
- The user prefers **CSS+SVG mockups** rendered for any A/B/C/D option (see `user-preference-visual-samples.md` in memory) — generate them rather than describing in text.
- The `docs/mockups/` directory and `.superpowers/brainstorm/*/content/*.html` are decision artifacts from earlier brainstorming; do not delete.
- The `docs/deploy/{cloudflare-pages.md,fly-io.md}` guides are partially stale: cloudflare-pages.md still describes the old "Pages proxies to Fly.io backend" model — the actual deployed topology is Pages → Worker (same provider). Read them for env-var / dashboard UI references; ignore the architecture diagrams.
- CodeGraph is **not** initialized in this project (`codegraph_status` returns "not initialized"). If you want to use it, run `codegraph init -i` first.
- When debugging "the seal is clipped / the icon overlaps / stacking looks wrong": check **DOM source order** in the parent `relative` wrapper, not just the inner element's `top`/`right`. A later sibling paints on top of an earlier one when both share a stacking context with `z-index: auto`. Use `z-10` + `pointer-events-none` on overlays for self-documenting intent.