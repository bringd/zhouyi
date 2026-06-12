# Cloudflare Pages 部署指南 — 易象阁（**仅前端**）

> 静态前端（Vite build）托管在 Cloudflare Pages。
> 后端 + Postgres 在 Fly.io（见 `docs/deploy/fly-io.md`）。
> **起步 $0**——Pages 免费层无限流量、无限请求。

## 架构

```
[ 用户浏览器 ]
    ↓
[ Cloudflare CDN (免费，全球边缘) ]
    ↓
[ Cloudflare Pages Project: orix-studio ]
    ├── /             → dist/index.html (SPA shell)
    ├── /assets/*     → Vite hashed assets (1 年缓存)
    ├── /codex, /hexagram/*, /divination → SPA 路由
    │   （public/_redirects 兜底 index.html）
    └── /api/ai/*, /api/records/*, /api/favorites/*  → 不在 Pages！
                                              ↓ 浏览器跨域到
                                              ↓
                              [ Fly.io: orix-studio.fly.dev ]
```

**关键：** Pages 只 serve 静态。`/api/*` 跨域到 Fly.io 后端（由 CORS `FRONTEND_ORIGIN` 允许）。

## 前置依赖

| 工具 | 用途 | 安装 |
|---|---|---|
| Cloudflare 账户 | Pages 主机 | https://dash.cloudflare.com/sign-up |
| GitHub 账户 | 触发自动部署 | 已有/注册 |
| GitHub repo | Pages source | 已有（本项目） |
| 域名（可选） | 自定义 URL | Cloudflare Registrar / Namecheap |

## Step 1 — 创建 Cloudflare Pages 项目

### 方式 A：通过 Cloudflare Dashboard（推荐，最简单）

1. 登录 https://dash.cloudflare.com/
2. 左侧栏 → **Workers & Pages** → **Pages** → **Create application** → **Pages** → **Connect to Git**
3. 选 GitHub 仓库 `yourname/zhouyi`（或你 fork 的）
4. **Set up builds and deployments**：
   - **Project name**: `orix-studio`（会得到 `orix-studio.pages.dev`）
   - **Production branch**: `main`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory (advanced)**: 留空（用 `/`）
   - **Environment variables (advanced)**:
     - `NODE_VERSION` = `20`（pin Node 20）
     - `PUBLIC_API_BASE` = `https://orix-studio.fly.dev`（如果用 Fly.io 后端）
5. **Save and Deploy** → 等 2-3 分钟 → 拿到 `https://orix-studio.pages.dev`

### 方式 B：直接用 Wrangler CLI

需要 Cloudflare API token。`wrangler pages deploy dist --project-name=orix-studio`——但失去了 GitHub 集成带来的自动部署。**不推荐**，除非你要手动控制部署时机。

## Step 2 — 配置文件说明

| 文件 | 作用 | Pages 是否认 |
|---|---|---|
| `wrangler.toml` | Cloudflare 项目配置（name, build output dir） | ✅ 认（Pages 兼容） |
| `public/_redirects` | SPA 路由兜底（任何路径 → index.html） | ✅ Pages 原生支持 |
| `public/_headers` | 路径级 HTTP 头（缓存、安全头） | ✅ Pages 原生支持 |

**这三个文件已就绪在仓库根**。Pages dashboard 会自动读 `_redirects` 和 `_headers`；`wrangler.toml` 用于 CLI 模式。

## Step 3 — 持续部署

配好 GitHub 集成后，**每次 push 到 main 自动部署**：

```bash
git push origin main
# → Cloudflare Pages 检测到新 commit
# → 自动跑 npm run build
# → 部署到 orix-studio.pages.dev
# → 30-60 秒后生效
```

查看部署状态：Cloudflare dashboard → Pages → orix-studio → **Deployments** tab。

## Step 4 — 配环境变量

dashboard → Pages → orix-studio → **Settings** → **Environment variables**：

| 变量 | 值 | 用途 |
|---|---|---|
| `NODE_VERSION` | `20` | pin Node 版本 |
| `PUBLIC_API_BASE` | `https://orix-studio.fly.dev` | 前端 fetch 后端的 base URL（如果用 Vite env vars） |

**注意：** Vite 暴露给前端的 env var 必须以 `VITE_` 或 `PUBLIC_` 开头（看你的 Vite 版本）。本项目目前直接 hardcode `localhost:3001` / `orix-studio.fly.dev`，可能要小改 `src/lib/ai.ts` 读 `import.meta.env.VITE_API_BASE`。

如果用 `VITE_API_BASE`：
1. dashboard 配 `VITE_API_BASE=https://orix-studio.fly.dev`
2. `src/lib/ai.ts` 改 `const BASE = import.meta.env.VITE_API_BASE ?? ''`
3. 后续 commit

## Step 5 — 自定义域名（可选，推荐）

### 5.1 买域名

`易象阁.com` / `zhouyi.app` / 任意。Cloudflare Registrar 是 $10/年 .com（不收溢价）。

### 5.2 绑到 Pages

dashboard → Pages → orix-studio → **Custom domains** → **Set up a custom domain**：
- 输入 `yourdomain.com` → 跟着向导（Cloudflare 自动加 CNAME + 签证书）
- 重复加 `www.yourdomain.com` → 自动 redirect 到 apex

### 5.3 改后端 CORS

```bash
fly secrets set FRONTEND_ORIGIN=https://yourdomain.com --app orix-studio
```

否则 CORS 拒绝（origin 不在白名单里）。

## Cloudflare CDN 优化（可选）

Pages 已经走 Cloudflare CDN（免费、全球边缘）。通常不需要额外配置。

如果想微调（dashboard → Pages → orix-studio → Settings）：

- **Builds**:
  - Build watch paths: 留空（监听所有路径）
- **Functions**:
  - 不需要（我们没有 Cloudflare Functions）
- **Runtime**: 静态（默认）
- **Compatibility flags**: 不需要

**Page Rules** (dashboard → Rules → Page Rules):
- `orix-studio.pages.dev/api/*` → Cache Level: Bypass（虽然我们不通过 Pages 跑 /api，但保险起见）

## 监控

dashboard → Pages → orix-studio → **Analytics**:
- 请求数、错误率、带宽
- 部署历史（每次 commit 一次部署）
- 实时日志（实时 tail build output）

告警：dashboard → Notifications → 加 Pages 告警（部署失败 / 错误率 > 阈值）。

## 故障排查

| 症状 | 可能原因 | 排查 |
|---|---|---|
| 404 on `/codex` 等 SPA 路由 | 缺 `_redirects` 兜底 | 检查 `public/_redirects` 有 `/* /index.html 200` |
| `/assets/*` 经常 404 | Vite build 路径错 | dashboard → deployments → 看 build output，确认 `dist/` 存在 |
| CORS 错 | 后端 `FRONTEND_ORIGIN` 没设成 Pages 域名 | `fly secrets list` 看 |
| 部署成功但页面空白 | Vite build 出错 | dashboard → deployments → 该次部署 → View build log |
| `PUBLIC_API_BASE` 没生效 | Vite env var 命名错（应该是 `VITE_*`） | dashboard → env vars，commit 代码读 `import.meta.env.VITE_API_BASE` |

## 成本估算

- Cloudflare Pages: **$0**（free tier 无限流量、无限请求、无限 builds）
- Cloudflare CDN: **$0**（自动包含）
- 域名（可选）: **$10/年**

**前端 $0**（只要域名想正式才花钱）。

## Rollback

dashboard → Pages → orix-studio → **Deployments** → 选历史版本 → **Rollback to this deploy**。

秒级回滚，不需要重新 build。

## 升级流程

```bash
# 本地改前端代码
git commit -m "feat: change button color"
git push origin main
# → Cloudflare Pages 自动 build + deploy
# → 30-60 秒后 orix-studio.pages.dev 生效
```

如果出问题：
```bash
git revert HEAD
git push origin main
# → 自动回滚到上一个绿色版本
```

或直接 dashboard 里 rollback 到任意历史版本。

---

## 关键文件清单

- `wrangler.toml` — Cloudflare 项目配置（可选，dashboard 模式不需要）
- `public/_redirects` — SPA 路由兜底（**必须有**）
- `public/_headers` — 缓存 + 安全头（**必须有**）
- `docs/deploy/cloudflare-pages.md` — 本文件

## 对照表：哪些文件 Pages 管，哪些 Fly 管

| 文件 | 部署到 |
|---|---|
| `src/` (前端) | **Pages** |
| `index.html` | **Pages** |
| `public/_redirects` | **Pages** |
| `public/_headers` | **Pages** |
| `public/*.svg`, `public/*.png` 等静态资源 | **Pages** |
| `dist/` (Vite build output) | **Pages**（自动生成） |
| `wrangler.toml` | **Pages**（仅作 build hint） |
| `server/src/` | **Fly** |
| `server/package.json` | **Fly** |
| `Dockerfile` | **Fly**（仅后端） |
| `fly.toml` | **Fly** |
| `docs/superpowers/` | 都不部署（开发文档） |
| `tests/` | 都不部署（CI 用） |
| `server/dist/` | **Fly**（Docker 内 build） |
