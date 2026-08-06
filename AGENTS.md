# AGENTS.md

Guidance for agentic coding agents (Claude Code, Codex, etc.) operating in this repository.

## Project: 易象阁 (Orix Studio)

64-卦 周易 (I Ching) study site: 64-卦图鉴 (codex), 今日卦境 (daily hexagram), 三数起卦 (three-number divination), AI 解读, community 卦册. Visual style: 国风动漫 / 工笔重彩 + 现代极简. Full architecture in **`AGENTS.project.md`** (deployment, env, bindings, deployment topology — read that before touching deploy / secrets).

Monorepo with **three** `package.json`s:

- **root** — frontend Vite+React SPA + Pages Functions
- **`server/`** — **DEPRECATED** legacy Express (in tree but not deployed; do not add new routes)
- **`worker/`** — current Cloudflare Worker + D1 (community backend)

Install both root and whichever backend you're editing.

## Common commands

```bash
# Frontend dev (http://localhost:5173)
npm install
npm run dev

# Worker dev (local D1 via miniflare, http://localhost:8787)
cd worker && npm install && npm run dev

# Build frontend — runs `build:sitemap` prebuild + `copy-functions` postbuild
npm run build

# Verify (all must pass before commit)
npm test                    # Vitest (root: tests/, tests/lib/, tests/components/, tests/pages/)
npm run test:watch
npm run typecheck           # tsc -b (root, covers src/ + tests/ + functions/)
cd worker && npm run build  # worker tsc --noEmit (NOTE: no `typecheck` script — use `build`)
cd worker && npm test       # vitest-pool-workers (5 files: auth/me/records-quota/session-middleware/migration)
npm run lint                # eslint (root only)

# Single test file
npx vitest run tests/lib/divination.test.ts

# Single test by name (substring match)
npx vitest run -t "daily hexagram"

# Worker D1 migrations
cd worker && npx wrangler d1 migrations apply zhouyi-db --local   # dev
cd worker && npx wrangler d1 migrations apply zhouyi-db --remote  # prod (only after Cloudflare env is configured — see AGENTS.project.md)
```

## Local dev is 3 processes

Vite (`:5173`) + Worker (`:8787`) + Pages Functions (`:8788`) are three separate runtimes. They must run in parallel; Vite proxies `/api/*` to whichever port (see `vite.config.ts`).

**Three dev-time footguns:**

1. **`.dev.vars` location** — `wrangler pages dev` reads from **root** `.dev.vars` (not `worker/.dev.vars`). For dev exercising both runtimes, put the same `AI_DEMO_KEY=...` in both files. Both are gitignored.
2. **Wrangler reads `.dev.vars` once at startup** — edit-then-test won't pick up new values. Restart the relevant process.
3. **`npm run build` fails without tsconfig exclude** — root `tsconfig.json` must `exclude: ["tests/worker", "worker"]` (already set). Without it `tsc -b` fails on missing wrangler/hono/drizzle types and `dist/` becomes stale.

## Code style

### Imports & formatting

- **Frontend (`src/`, `tests/`, `functions/`)**: standard Vite+TS, ESM imports with explicit `.ts`/`.tsx` extensions allowed via `allowImportingTsExtensions`. Path alias `@/*` → `src/*`.
- **Worker (`worker/src/`)**: `module: "ESNext"`, **MUST** use `.js` import suffixes (`from './app.js'`) — TS resolves to `.ts` at build time. New files must follow this convention.
- **Pages Functions (`functions/`)**: plain TS, no build step — Cloudflare transpiles at edge.
- **Single quotes, no semicolons** in frontend src (Prettier default). Worker src follows same convention.
- **`noUnusedLocals` + `noUnusedParameters` are on** — dead code fails typecheck. Clean up imports and unused parameters.

### Types

- **Strict mode on** everywhere. Avoid `any`; prefer `unknown` + narrowing.
- Hexagram binary code is **always 6 chars, bottom-to-top**: `binary[0]` = line 1 (bottom), 1 = yang, 0 = yin. Used in `flipLine`, `flipAll` (错卦), `reverseAll` (综卦), `buildNuclearBinary` (互卦). Don't flip this convention.
- `src/types/` defines `Hexagram`, `HexagramId`, etc. — never inline-shape hexagram objects in component code.

### Naming

- Components / types / classes: **PascalCase**.
- Functions / variables: **camelCase**.
- Pure helpers in `src/lib/`: named exports, NO side effects, fully unit-tested in `tests/lib/`.
- Test files: mirror source path + `.test.ts(x)` suffix.
- React components: filename = component name in PascalCase (`HexagramCard.tsx`).

### Error handling

- AI errors: throw `AIError` with stable `code` from `src/lib/ai.ts` (`'no-api-key'`, `'unauthorized'`, `'rate-limit'`, `'server-error'`, `'timeout'`, `'network-error'`, `'content-filtered'`, `'quota-exceeded'`, `'upstream-error'`, `'token-limit'`). UI switches on `code`, not message.
- Worker routes: Hono handlers return typed JSON errors with `{ error: <code>, message }`. Use `c.json(..., <status>)`.
- Storage / localStorage: defensive reads via `src/lib/storage.ts`; corrupt JSON → fall back to defaults, don't throw.
- Fetch failures: don't swallow — log via `console.warn` (rare) or rethrow with context.

### TDD for `lib/`

- Every pure helper in `src/lib/` MUST have a Vitest spec in `tests/lib/`. Run `npx vitest run tests/lib/<file>.test.ts` while iterating.
- Worker integration tests live in `tests/worker/` and use `vitest-pool-workers` (needs D1 binding). Windows miniflare emits `EBUSY` warnings on temp dir cleanup — this is **noise, not a failure**.

### State management

- No global store at time of writing — frontend state is component-local. `zustand` is in deps for when cross-page state is needed.

### SSE contract

Server sends `data: {...}\n\n` events. Frontend splits on `\n\n`, parses JSON, looks for `type` field. Don't change event shape without updating both producer and `src/lib/ai.ts`.

## Conventions & pitfalls

- **CORS**: `FRONTEND_ORIGIN` accepts comma-separated list. Do NOT set `origin: '*'` with `credentials: true` — forbidden combo.
- **Secrets**: never commit live keys. Local: `worker/.dev.vars` or root `.dev.vars` (both gitignored). Prod: Cloudflare dashboard secrets via `wrangler pages secret put <NAME> --project-name=orix-studio` or `wrangler secret put <NAME>`. Don't pipe live keys through Bash prompts.
- **Path alias**: `@/*` → `src/*`. Don't use relative paths longer than `../../../`.
- **`functions/` routing**: Pages Functions do **NOT** support dynamic `[...slug]` / `[[slug]]` filenames. Use exact paths (e.g. `functions/api/proxy/anthropic/v1/messages.ts`). Dynamic segments silently 404.
- **Functions in `dist/`**: `scripts/copy-functions.mjs` (build post-step) mirrors `functions/` → `dist/functions/`. Without it, deployed Pages has no Functions and `/api/proxy/anthropic/*` returns 404.
- **D1 binding** must be added in Cloudflare dashboard (Pages → Settings → Functions → D1 database bindings → Variable `DB` → Database `zhouyi-db`). `wrangler.toml.example` alone is not enough for GitHub App auto-deploy path.
- **Deployment**: Pages builds via Cloudflare Cloudflare GitHub App from `main`. Don't rename `wrangler.toml.example` to `wrangler.toml` (different deploy path).

## Things to know before editing

- `src/pages/YaoDesignCompare.tsx` and many `scripts/shot-*.mjs` / `check-*.mjs` / `verify-*.mjs` files are visual / acceptance test tooling — **not production code**, don't refactor them when touching the app.
- `scripts/fill-yao-batch{1..8}.mjs` and `scripts/fill-modern-interpretations.mjs` are one-shot data-fill scripts for `hexagrams.json`. Not part of the build pipeline.
- `docs/mockups/` and `.superpowers/brainstorm/*/content/*.html` are decision artifacts from earlier brainstorming — do not delete.
- `docs/deploy/cloudflare-pages.md` and `docs/deploy/fly-io.md` are **partially stale** (still describe old Fly.io topology). Read for env-var / dashboard UI references; ignore architecture diagrams. See `AGENTS.project.md` for current truth.
- When debugging "the seal is clipped / the icon overlaps / stacking looks wrong": check **DOM source order** in the parent `relative` wrapper, not just the inner element's `top`/`right`. Use `z-10` + `pointer-events-none` on overlays for self-documenting intent.

## Before claiming a task is done

1. `npm test` — all pass.
2. `npm run typecheck` — 0 errors.
3. `cd worker && npm run build` — 0 errors.
4. If you touched worker routes: `cd worker && npm test` — all pass.
5. If you changed a UI string: search for the old string (`grep -r "旧文案"`), confirm no stale references in tests or components.

Do NOT push to `origin/main` without explicit user instruction. Do NOT commit unless asked.
