# 易象阁仓库结构整改计划

**日期**: 2026-08-15
**状态**: 架构评审已通过（**有条件通过**），按评审意见修订
**目标**: 把根目录 4 套部署面（Pages SPA + Worker + Pages Functions + 计划中的小程序）+ 1 套遗留 Express 收口为清晰 monorepo

---

## 评审总评

**有条件通过** —— 1/2/4 步方向对，第 3 步低估了 Cloudflare Pages 的目录耦合，须补 dashboard 变更清单 + preview 验证关口。顺序修正为 **1 → 2 → (3 ∥ 4)**。

---

## 第 1 步：清遗留

**改动**：
- 删 `server/`（AGENTS.md 自标"not deployed"）、`Dockerfile`、`.dockerignore`、`fly.toml`
- 删根 `package.json` 的 `server:dev`、`server:build`、`dev:all` 脚本；`concurrently` 依赖移除
- 删根目录的 `nul` 文件（Windows 产物）
- 把 `scripts/fill-modern-interpretations.mjs` 标 `@deprecated`（读 `server/.env` + `server/node_modules` 的 Anthropic SDK）
- `scripts/verify-j3-flow.mjs:17`、`scripts/screenshots.mjs:8` 指向 legacy `:3001` 的引用改为注释"legacy port, see git history"
- `docs/deploy/fly-io.md` 改为"历史归档"标注
- `.gitignore` 删 server 条目；增加 `.wrangler/`
- 同步更新 `README.md`、`CLAUDE.md`、`AGENTS.project.md`、`worker/README.md`、`opc-doc/` 中对 server/ 的所有引用
- 删除前确认 `server/.env`（gitignored）已无依赖

**Grep 清单（评审建议扩列）**：
- `server/`、`server:`、`:3001`、`fly.toml`、`Dockerfile`、`.dockerignore`、`concurrently`

**验证**：`npm test` + `npm run typecheck` + `npm run build` 全绿。`npm run lint` 全绿。

---

## 第 2 步：引入 pnpm workspaces（不动目录，只建脚手架 + 试点）

**改动**：
- 全仓改用 pnpm：`npm install -g pnpm` 后 `pnpm import`（**只复用根 lock**；`worker/package-lock.json` 被弃，重新解析，需 **pin wrangler + vitest-pool-workers 版本后 diff**）
- 新建 `pnpm-workspace.yaml`：
  ```yaml
  packages:
    - 'apps/*'
    - 'packages/*'
  ```
- 新建 `packages/shared/package.json`（name: `@zhouyi/shared`）
- **先只挪 1 个纯函数验证链路**：`packages/shared/src/validation.ts`（最小、无依赖）+ 单测镜像搬入 `packages/shared/tests/validation.test.ts`
- 验证：根 `tsconfig.json` 加 `paths: { "@zhouyi/shared/*": ["packages/shared/src/*"] }`、web `vite.config.ts` 同步 alias、vitest 配置兼容 → 跑通再批量
- 批量迁移（**每 lib 一个 PR**）：
  - PR2a: `packages/shared/src/divination.ts` + 单测 + `worker/src/lib/hexagramData.ts:9` 路径同步改
  - PR2b: `packages/shared/src/relations.ts` + 单测
  - PR2c: `packages/shared/src/sampleQuestions.ts` + 单测
  - PR2d: `packages/shared/src/daily.ts` + 单测（Intl 适配层先不动，单迁）
  - PR2e: `packages/shared/data/hexagrams.json` + `trigrams.json` —— **必须同步改** `scripts/generate-sitemap.mjs:15`（读 src/data）与 `worker/src/lib/hexagramData.ts:9` 的相对路径
  - PR2f: `packages/shared/types/*.ts`
- Taro 后续阶段：`packages/shared` 进 Taro webpack/vite 的 `include`（小程序计划 R5）

**验证**：每个 PR 跑全套 `test`/`typecheck`/`build`/`lint`，确认 `worker`、`functions/`、`src/` 全部通过 `@zhouyi/shared/...` import 拿到正确模块。

**绝对不做的**：尝试用 Nx/Turbo（过度设计）；用 git submodule（更差）；改 `@/*` alias 指向 shared（污染语义，shared 走包名 import）。

---

## 第 3 步：迁移根 → apps/web（必须原子 PR）

**这一步骤最危险**：Cloudflare Pages 的 Root directory、Build command、Output dir、Functions 路径、D1 binding 都在 **dashboard** 配置（不在仓库），任何错配部署看似成功但 AI 代理静默 404。

**改动**：
- `apps/web/` 接住：根 `src/`（pages + components）、根 `index.html`、`vite.config.ts`、`tailwind.config.ts`、`postcss.config.js`、`tsconfig.json`、`tsconfig.node.json`、根 `tests/`（除 tests/worker）、`public/`、`functions/`、根 `scripts/copy-functions.mjs` + `scripts/generate-sitemap.mjs`
- `apps/worker/` 接住：`worker/` + `worker/vitest.config.ts`
- `tests/worker/` 随 worker 挪进 `apps/worker/tests/`（评审建议）
- **scripts 路径修正**：`scripts/copy-functions.mjs:18-21` 用 `resolve(here,'..')` 定位根，挪到 `apps/web/scripts/` 后路径自动重指；`scripts/generate-sitemap.mjs` 同理
- `wrangler.toml.example` 移到 `apps/web/`，保留 `pages_build_output_dir = "./dist"`

**Dashboard 变更清单（PR 必须附上）**：
1. Pages → Settings → Build → **Root directory: `apps/web`**（旧值：`/`）
2. Pages → Settings → Build → **Build command: `pnpm install --frozen-lockfile && pnpm build`**（旧值：`npm run build`）
3. Pages → Settings → Build → **Build output directory: `dist`**（旧值：`dist`，保持相对，相对 Root 解析 OK）
4. Pages → Settings → Environment variables：保持
5. Pages → Settings → Functions → D1 bindings：变量 `DB` → 数据库 `zhouyi-db`（**重新确认绑定在**）
6. Pages → Settings → Secrets：`AI_DEMO_KEY` 等保留

**回滚步骤**（PR 描述必填）：
- git revert
- Dashboard Root directory 改回 `/`
- 触发一次空 commit 让 Pages 重新识别 Root

**验证关口（评审强调，npm test 抓不到）**：
- 本地 `cd apps/web && pnpm build && pnpm preview` 跑通
- **真部署到 Cloudflare Pages preview 环境**，手动 curl `/api/proxy/anthropic/v1/messages` 确认代理活着（这是 Pages Functions 唯一能验证的方式）
- 跑 Worker 集成测试 `cd apps/worker && pnpm test`

**配套文档更新**：
- AGENTS.md 三终端指引（CLI 路径写死 `D:/eight`）改写
- CLAUDE.md 同改
- 新增 `docs/deploy/cloudflare-pages.md` 章节说明新 Root directory 与 dashboard 位置
- 新增 `docs/deploy/MIGRATION.md` 记录此次重组（评审建议落 `docs/deploy/`）

---

## 第 4 步：起小程序壳 `apps/miniprogram/`（可与第 3 步并行）

**改动**：
- `apps/miniprogram/` 用 `taro init` 生成（React + TS）
- 通过 `@zhouyi/shared` 共享纯函数与数据
- 走先前 `docs/plans/2026-08-15-orix-miniprogram-port.md` 的 M0

**重要（评审提醒）**：**M0 真机实测（SSE / Intl / 云函数）可以与第 3 步并行启动**，是整个小程序计划最大未知（D2/R3/R4），别把最高风险验证排最后。

---

## 顺序与 PR 拆分

| 顺序 | PR | 内容 | 关键约束 |
|---|---|---|---|
| 1 | PR1 | 清遗留（删 server/ 等 + 文档同步） | grep 全清、并发删除测试 |
| 2 | PR2 | pnpm workspaces + 1 个 lib 试点 | 验证 build 链路 |
| 3 | PR3a-f | shared/ 批量迁移（每 lib 一个 PR） | 路径同步改 |
| 4 | PR4 | 迁移到 apps/web + apps/worker | **原子 PR** + dashboard 清单 + 回滚步骤 + 真部署验证 |
| 5 | ∥ PR5 | apps/miniprogram Taro 壳 | 与 PR4 并行 |
| 6 | ∥ M0 | 小程序真机实测 SSE/Intl/云函数 | 与 PR4 并行 |

**禁止**：第 2、3 步合并 PR（半挪状态无法构建）；PR4 拆 PR（部署 dashboard 原子切换）。

---

## 关键约束（评审高亮）

| 主题 | 约束 |
|---|---|
| Cloudflare Pages Root dir | dashboard 设置，不在仓库，挪 `functions/` 必须改 dashboard，否则静默 404 |
| `dist/` 输出 | 相对 Root 解析，Root 改了 dist 路径要确认 |
| `wrangler.toml.example` `pages_build_output_dir = "./dist"` | 保留相对路径，挪到 apps/web 下自动正确 |
| D1 binding | dashboard 设置 `DB → zhouyi-db`，必须复核迁移后还在 |
| `.dev.vars` | `wrangler pages dev` 从 cwd 读，挪到 `apps/web/.dev.vars` |
| 三终端指引 | AGENTS.md / CLAUDE.md 写死的 `D:/eight` 路径需更新 |
| pnpm import | 只吃根 lock；worker lock 弃用，必须 pin wrangler + vitest-pool-workers |
| Taro 默认不编译 node_modules | `@zhouyi/shared` 进 Taro `include` |

---

## 风险

- **PR4 部署事故**：Root directory 改错 → Functions 静默 404，需 preview 真部署 + curl 兜底
- **shared 包拆分漏文件**：worker 的 `hexagramData.ts:9` 与 `generate-sitemap.mjs:15` 必须同步改，否则 CI 不抓的运行时报错
- **pin 版本漂移**：pnpm 重解 `worker/package-lock.json` 后 wrangler / vitest-pool-workers 拉到新版，需 diff
- **doc 漂移**：AGENTS.md / CLAUDE.md / README / AGENTS.project.md 任一未同步 = 下次 Agent 走错路径

---

## 评审文档

完整评审记录：`docs/plans/2026-08-15-repo-restructure-review.md`