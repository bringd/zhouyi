# 易象阁 接手盘点 + 基线审计

日期：2026-10-13
基线 commit：`ea405e0`（= `origin/main`）
当前 HEAD：`1d45588`（本地领先 2 个 commit，**未 push**）

---

## 一、交付状态

### 本次已交付（2 个 commit）

| commit | 内容 |
|---|---|
| `08e00e9` | `fix(data): backfill relations.{opposite,inverse,nuclear} for all 64 hexagrams` |
| `1d45588` | `fix(data): backfill modernInterpretation for the 60 empty hexagrams` |

### 门禁（实测）

| 门 | 基线 `ea405e0` | C4 后 | C1 后 | 现工作区 |
|---|---|---|---|---|
| root `npm test` | 301 / 37 文件 | 305 / 37 | 328 / 38 | **333 / 38** |
| root `npm run typecheck` | 0 | 0 | 0 | **0** |
| `worker && npm run build` | 0 | 0 | 0 | **0** |
| `worker && npm test` | 15 / 4 文件 | — | 15 / 4 | **15 / 4** |
| `node scripts/fill-modern-interpretations.mjs --check` | — | — | 64/64 | **64/64 valid** |

### 本地 dev 三进程（生产同款拓扑）

| 进程 | 端口 | 实测 |
|---|---|---|
| Vite SPA | 5173 | 200 |
| Worker | 8787 | `/health` 200 |
| `wrangler pages dev dist` | 8788 | 200 |

Vite 已在提供新数据（`/src/data/hexagrams.json?import` 中「方为得卦之真意。」出现 **64** 次）。

---

## 二、已验证正确（可放心）

- **relations 192/192 与生产运行时算法一致**：`src/lib/relations.ts` 的 `getOpposite`/`getInverse`/`getNuclear` 逐条比对通过。
- **传统定义正确**：错 = 翻 6 位、综 = 倒序、互 = 第 2-3-4 爻叠 3-4-5 爻。经典对（屯蒙/需讼/泰否/坎离/既济未济 错综；屯互剥、需互睽）抽验通过。
- **结构 diff 干净**：`ea405e0 → HEAD` 仅改动 `relations`(64) + `modernInterpretation`(60)，无其他字段、键序不变、数组长度 64。
- **60 条文本未串卦**：逐条核对卦名与内容对应。
- **手写原稿未被覆盖**：id 1-4 原样保留（生成器显式跳过，`--force` 才覆盖）。
- `scripts/fill-relations.mjs` 行为与其描述一致；`tests/samples/` 从未入库；`public/sitemap.xml` 未被污染。

### 本次新加的两层护栏（已做变异测试证明有效）

C1 的失败模式是「数据空 + 组件 `{x && …}` 静默不渲染」，数据层断言抓不到 DOM 层。故补了 UI 层护栏：

- `tests/pages/HexagramDetail.test.tsx` — +3：对 id 1/30/64 渲染后，用**同一份** `src/lib/modernInterpretation.ts` 契约断言 DOM 里的文本合规。
- `tests/components/DailyHero.test.tsx` — +2：Hero 渲染该段；文本为空时**不留孤儿节点**。

**变异测试**：把 id=30 的 `modernInterpretation` 清空后，两个文件**同时失败**（`id=30 离为火: empty` / `id=30 has no 现代解读 paragraph`），随后 `git checkout` 还原。→ 护栏不是空转。

---

## 三、未决问题（重新定级，附证据）

### A. 账户体系「未接线」—— 阻塞下一步 plan，但**当前不面向用户**

原先记为 Critical「生产 `/api/auth/*` 404」。实测后机制更精确，且**严重度下调**，理由如下。

**实测（`:8788` = Pages Functions 运行时，与生产同款路由）**

| 请求 | 结果 |
|---|---|
| `GET /api/auth/me` | **200 + `index.html`**（不是 404 —— 被 SPA fallback 吞了） |
| `GET /api/feed?limit=1` | 200 + `index.html` |
| `POST /api/auth/sms/send` | **405** |

**机制**
1. `functions/` 下只有 `api/proxy/anthropic/v1/messages.ts` 一个函数；Worker 的 auth 路由在 **另一个 origin**（`zhouyi-worker.bringd.workers.dev`）。
2. `public/_routes.json` 声明 `include: ["/api/*"]`，但没有对应函数文件的路径会落到静态资源。
3. `public/_redirects` 的 `/*  /index.html  200` 于是把 `GET /api/*` 变成 **200 HTML**，`POST` 因规则只匹配 GET 而变成 **405**。

**关键：当前没有任何 UI 会打到这些路由**
- `src/lib/auth.ts`（`refreshAuth` 打同源 `/api/auth/me`）**在整个 `src/` 中零引用**，只有 `tests/lib/auth.test.ts` 在测它 → 测试在给死代码背书。且 `refreshAuth` 没有 `res.ok` 检查、没有 try/catch，一旦真接上会因 `res.json()` 解析 HTML 抛 `SyntaxError`，`cache` 永远停在 `loading`。
- `src/components/auth/SmsModal.tsx`（打 `/api/auth/sms/send|verify`）**在整个 `src/` 中零引用**，只有 `tests/lib/SmsModal.test.tsx` 在测它。
- `src/lib/quota.ts` —— CLAUDE.md 明确写「前台配额闸门 src/lib/quota.ts」——**该文件不存在**。

**结论**：当前实际产品形态 = 全体匿名 demo 用户，只有 Pages Function 的**按 IP 每日 5 次** AI 配额（`ai.ts` 读 `X-AI-Quota-*`）。注册/登录/按用户记录**均未接线**。所以 C3 不会产生用户投诉，但它是 `docs/plans/2026-08-20-account-system.md`（下一步 plan）**一接上就必炸**的硬阻塞。

**必须同批修的三半（拆开修一定返工）**

| # | 位置 | 问题 |
|---|---|---|
| C3 | `auth.ts:13`、`SmsModal.tsx:27,52` | 同源相对路径；Worker 在别的 origin。`feed.ts` 已有正确范式（`PROD_BASE` 绝对地址 + `credentials:'include'`），auth 没跟。 |
| M7 | `worker/src/middleware/session.ts:135-139` | cookie 为 `SameSite=Lax` 且**不设 `Secure`**（注释还写「应由部署代理补 Secure」）。跨站 fetch 下 `Lax` **不会带上 cookie** → 即便改对 URL，登录也会「看似成功但 `/api/auth/me` 仍返回 guest」。跨站必须 `SameSite=None; Secure`，而 `None` **强制**要求 `Secure`。 |
| M5/M6 | `worker/src/middleware/cors.ts` | 用 `origin === allowed` **精确比较**，而 AGENTS.md 写 `FRONTEND_ORIGIN` 支持逗号分隔列表 → 一旦填列表，`isAllowed` 恒 false，且会把**整个逗号串**当 `Access-Control-Allow-Origin` 回给浏览器（非法值）。目前 `worker/wrangler.toml` 的 prod/staging 都是单值，**故为潜在缺陷、当前不炸**。拒绝时回显「配置的 origin」而非省略该 header，也不正确（浏览器会拦，无可利用性）。另注释称「or '*' for credentials」，代码从不发 `*` —— 注释过期。 |

**顺带**：`records` / `favorites` 前端**完全没有调用**（走 `localStorage`），所以这两个 Worker 路由同样未接线。

### B. 权威文档未入库 —— 227 个未跟踪文件（**建议优先，成本最低**）

`git ls-files --others --exclude-standard` = **227** 个。**并非被 .gitignore 忽略，纯粹是没 `git add`**。

| 路径 | 入库数 | 说明 |
|---|---|---|
| `CLAUDE.md` | **0** | agent 指南，权威度低于 AGENTS.md 但仍被引用 |
| `docs/plans/` | **0**（8 个文件） | 含下一步 plan `2026-08-20-account-system.md`（52KB） |
| `docs/archive/` | **0**（2 个文件） | 含 `2026-08-15/repo-restructure.md` |
| `docs/reviews/` | **0** | 含 `2026-08-07-architect-handoff.md`，与 `docs/plans/` 下同名文件**重复** |
| `scripts/*.mjs` | 18 已跟踪 / ~19 未跟踪 | 视觉验收工具（`verify-modern-clip.mjs` 等） |
| `docs/opencode-token-plan-setup.md`、`docs/mockups/2026-06-05-p0-cta-empty.html` | 0 | |

对比：`AGENTS.md`、`AGENTS.project.md`、`README.md`、`docs/superpowers/**`、`docs/deploy/**`、`docs/mockups/feature-templates-*/**` **都已入库**。

**风险**：这些文件只存在于本机 —— clone 拿不到、CI 拿不到、没有任何备份。**下一步 plan 本身就在未跟踪目录里。**

### C. `.gitignore` 缺项 —— `git add -A` 会污染仓库

`.wrangler/`(18 个文件，本地 D1 sqlite 状态)、`opc-doc/`(38)、`screenshots/`(~45)、`.opencode/agents`(2)、`.superpowers/visual/`(2) **都不在 .gitignore 里**（`.claude/` 已忽略，`.opencode/` 没有）。

### D. 文档漂移（同 A，但值得单独列出）

- CLAUDE.md 的「Phase 1：guest 1 次免费 + SMS 注册解锁无限」与「前端闸门 `src/lib/quota.ts`」**与实际代码不符**（文件不存在；实际是按 IP 每日 5 次）。
- CLAUDE.md 的验证命令写 `cd worker && npm run typecheck` —— **worker 没有这个 script**（实测 `worker/package.json` 只有 `build: tsc --noEmit`；AGENTS.md 已修正为用 `npm run build`）。
- AGENTS.md 称「`wrangler.toml.example` 别重命名」，实际 `worker/wrangler.toml` **已存在且已入库**，`worker/wrangler.toml.example` **不存在**；根目录才有 `wrangler.toml.example`。表述容易误导。
- `docs/deploy/{cloudflare-pages,fly-io}.md` 仍描述旧 Fly.io 拓扑（已知，AGENTS.md 有说明）。

> 已排除的伪漂移：CLAUDE.md 架构图的 `(model: minimax-m3)` **是对的** —— `src/lib/apiConfig.ts:52` 的 `DEFAULT_MODEL` 就是 `'minimax-m3'`，Pages Function 只钉 upstream URL、不改 model。`MiniMax-Text-01` 仅是一次性填充脚本 `scripts/fill-modern-interpretations.mjs` 的自选模型，不构成文档问题。

### E. 其他（M 级，未处理）

- **M3**：`apiConfig.ts` / `feed.ts` / `nickname.ts` 无测试（`auth.ts`、`SmsModal.tsx` 有测试但是死代码）。
- **M8–M11**：sitemap / robots / OG 相关未审完。
- **C6**：feed 内容有 U+FFFD 乱码，需 D1 `--remote` 才能确认。
- **M4**：`npm run lint` —— eslint 未安装。

---

## 四、复现命令

```powershell
# 基线
git log --oneline -n 3
npm test ; npm run typecheck
cd worker ; npm run build ; npm test ; cd ..

# 数据契约（不调 API）
node scripts/fill-modern-interpretations.mjs --check

# C3 证据：生产同款 Pages 路由
Invoke-WebRequest http://localhost:8788/api/auth/me -UseBasicParsing          # 200 + index.html
Invoke-WebRequest http://localhost:8788/api/auth/sms/send -Method POST `
  -Body '{"phone":"13800138000"}' -ContentType 'application/json'             # 405

# 未跟踪文件盘点
git ls-files --others --exclude-standard | Measure-Object
git ls-files docs/plans | Measure-Object      # 0
git ls-files CLAUDE.md | Measure-Object       # 0

# 死代码确认
Select-String -Path 'src/**/*.ts','src/**/*.tsx' -Pattern 'refreshAuth|SmsModal'
Test-Path src/lib/quota.ts                    # False
```

---

## 五、建议的下一步顺序

1. **B（文档入库 + .gitignore 补漏）** —— 最低风险、最高保护收益；下一步 plan 本身正在未跟踪目录里裸奔。
2. **A（C3 + M7 + CORS 同批修）** —— 真正的前置阻塞；`feed.ts` 已有范式可抄，且修完才谈得上接线账户体系。
3. **C/D 文档漂移对齐** —— 与 1 同批做最经济。
4. E 各项按需。
