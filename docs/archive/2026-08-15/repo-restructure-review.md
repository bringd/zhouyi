# 架构评审：易象阁仓库结构整改计划

**日期**: 2026-08-15
**评审对象**: 4 步仓库整改计划（清遗留 + pnpm workspaces + apps 迁移 + 小程序壳）
**评审 Agent**: architect（只评判不实现）
**状态**: **有条件通过**，已合入主计划 `docs/plans/2026-08-15-repo-restructure.md`

---

## 总评

**有条件通过** —— 1/2/4 方向对，第 3 步低估了 Cloudflare Pages 的目录耦合，须补 dashboard 变更清单 + preview 验证关口。

---

## 关键问题

### 第 1 步：grep 模式太窄

漏掉：
- `README.md:34-55`、`CLAUDE.md:11,152,165`、`AGENTS.project.md:11,115,126,128`、`worker/README.md:4`
- `scripts/fill-modern-interpretations.mjs:21-42` 读 `server/.env` 且从 `server/node_modules` require Anthropic SDK
- `scripts/verify-j3-flow.mjs:17`、`scripts/screenshots.mjs:8` 指 legacy `:3001`
- `.gitignore:11-14` server 条目、`.dockerignore`
- `server/.env` 在盘上（gitignored、含真 key），删前确认
- `dev:all` 删后 `concurrently` 变死依赖
- **正确模式**：`server/`、`server:`、`:3001`、`fly.toml`、`Dockerfile`、`.dockerignore`、`concurrently`
- npm test/typecheck 抓不到脚本断链，靠 grep 清单兜底

### 第 2 步：实施可行性

- pnpm workspaces 合适（Nx/Turbo 过度）
- **"全仓 pnpm import 复用 lock"表述错误**：只吃根 lock，`worker/package-lock.json` 被弃重新解析；vitest2（根）/ vitest3（worker）共存没问题，但 **wrangler / vitest-pool-workers 版本漂移需 diff 后 pin**
- `packages/shared` 形态正确（project references 不解决运行时打包，submodule 更差）
- **隐藏耦合**：`worker/src/lib/hexagramData.ts:9` 跨包 import `../../../src/data/hexagrams.json`；`scripts/generate-sitemap.mjs:15` 也读 `src/data` —— 挪 `data/` 的 PR 必须同改
- 测试跟移：`tests/lib/*.test.ts` import `../../src/lib/*`，每 lib PR 连同镜像测试一起挪；根 vitest 配置不用改
- `@/*` 保持指向 web 的 src，shared 走包名 import，勿嵌套 alias
- Taro 默认不编译 node_modules，shared 要进 compile include（小程序计划 R5）

### 第 3 步：关键约束（最危险）

- **`functions/` 相对 Pages "Root directory"（dashboard 设置，现为 `/`）解析**。挪进 `apps/web/functions` 必须同步把 dashboard Root directory 改为 `apps/web`，否则 Functions **静默 404** —— 部署看似成功、AI 代理独死，且该配置不在仓库、无 CI 可拦
- `dist` 输出目录同理随 root dir 改
- `scripts/copy-functions.mjs:18-21` 用 `resolve(here,'..')` 定位根：scripts/ 必须与 functions/ 同挪（连同 prebuild 的 generate-sitemap）
- `.dev.vars`：pages dev 从 cwd 读，挪后在 apps/web/ 重建；AGENTS.md footgun 1 与 CLAUDE.md 三终端指引（写死 `D:/eight`）重写
- `wrangler.toml.example` 挪 apps/web，`pages_build_output_dir="./dist"` 保持相对
- worker→apps/worker：`worker/vitest.config.ts:9` include `../tests/worker/**` 会断，先定 tests/worker 归属；根 `tsconfig.json:2` exclude 同改
- 计划漏挪：`tests/`、`public/`、`tailwind.config.ts`、`postcss.config.js`、`tsconfig(.node).json`
- **验证关口**：合入后必须 preview 部署并真请求 `/api/proxy/anthropic/v1/messages`，本地 vitest 保不了 dashboard

### 第 4 步与小程序计划衔接

- 第 4 步只依赖第 2 步的 shared，不依赖第 3 步
- 且 M0 真机实测（SSE/Intl/云函数）是整个小程序计划最大未知（`docs/plans/2026-08-15-orix-miniprogram-port.md` D2/R3/R4）
- **顺序改为 1 → 2 → (3 ∥ 4)**，别把最高风险验证排最后
- 该计划文档 §2 的 monorepo 形态与 D5 假设被本次重构改写，需同步

### 顺序与可逆性

- 拆 PR：PR1=清理；PR2=pnpm+validation.ts 试点；PR3a-f=每 lib 一个（好，保持）
- **PR4=apps 迁移单原子 PR**（半挪状态无法构建，不可拆），附 dashboard 变更清单 + 回滚步骤（dashboard 复原 + git revert）
- PR5=小程序壳
- 2、3 勿合并

### 其他遗漏

- 无 `.github/`（已查证），部署全押 dashboard → 变更清单落 `docs/deploy/`
- 死痕迹：根目录 `nul` 文件（Windows 产物）、`.wrangler/` 未进 .gitignore（补）、`docs/deploy/fly-io.md` 转纯历史（标注勿删）、`opc-doc/` 确认去留
- `package.json` `format` 只扫 `src/**`，迁移后改；`.env.example` 注释引 `worker/.dev.vars`

---

## 决策意见

- ✅ 同意 PR1（清遗留）、PR2（pnpm workspaces）、PR5（小程序壳）
- ⚠️ PR3（apps 迁移）必须按本评审补 dashboard 清单 + preview 验证
- 顺序修正：**1 → 2 → (3 ∥ 4)**，M0 真机实测与 PR3 并行启动
- 每 lib PR3a-f 拆 PR 是好做法

---

## 必做清单（已合入主计划）

1. **[必做]** PR4 附 dashboard 清单：Root directory=apps/web、Build command=pnpm、Output=dist、D1 binding `DB` 复核；部署后真请求 AI 代理
2. **[必做]** data/ 迁移 PR 同改 `hexagramData.ts:9` + `generate-sitemap.mjs:15`
3. **[必做]** copy-functions/generate-sitemap 随 functions/ 挪 apps/web/scripts/
4. **[必做]** 扩 grep 模式；README/CLAUDE/AGENTS 同步；fill-modern-interpretations 标废弃
5. **[必做]** M0 真机实测提前，与第 3 步并行
6. **[应该]** 迁移前 pin wrangler/vitest-pool-workers 版本并 diff 新 lock
7. **[应该]** 定 tests/worker 归属（建议随 worker 挪）
8. **[可缓]** shot-*/verify-* 视觉脚本断链只标注不重构（守 AGENTS.md 约定）