# Fly.io 部署指南 — 易象阁

> 一台机器跑全栈（前端 + Express + Postgres），月费 $0-7 起步。
> 完整 step-by-step，预计 30-60 分钟第一次跑通。

## 架构

```
[ Browser ]
    ↓
[ Cloudflare (optional) ] — CDN / SSL / 防 DDoS / DNS
    ↓
[ Fly.io :443 / :80 ] — 反代 + TLS
    ↓
[ Fly Machine (shared-cpu-1x, 512MB) ]
    ↓
[ Docker container :8080 ]
    ↓
[ Express (server/dist/index.js) ]
    ├── /health        → 200 OK
    ├── /api/*         → 业务 API
    ├── /api/ai/...    → 流式 Claude API
    ├── static assets → /app/dist/  ← Vite build 产物
    └── /* (非 /api)   → /app/dist/index.html (SPA fallback)

[ Fly Postgres (separate app) ] — 托管 PG，$1.94/月 1GB 起步
```

## 前置依赖

| 工具 | 用途 | 安装 |
|---|---|---|
| `fly` CLI | Fly.io 命令行 | `curl -L https://fly.io/install.sh \| sh` (Linux/macOS) / `iwr https://fly.io/install.ps1 -useb \| iex` (Windows) |
| `git` | 部署触发 | 已有 |
| GitHub 账户 | 触发自动部署（可选） | 已有/注册 |
| Anthropic API key | AI 解读 | https://console.anthropic.com |
| 域名（可选） | 自定义 URL，不买用 `*.fly.dev` 即可 | Cloudflare Registrar / Namecheap |

## Step 1 — 注册 Fly.io 账户

```bash
fly auth signup    # 会打开浏览器走 OAuth
# 或
fly auth login     # 已有账户
```

`fly auth whoami` 验证登录。

## Step 2 — 改 `fly.toml` 的 `app` 名

`app` 字段必须全局唯一。改成一个没被占的：

```toml
app = "zhouyi-yourname-2026"   # 例: zhouyi-qi-2026
```

`grep "primary_region"` 也确认一下：默认 `sin`（新加坡）。如果用户主要在北美，改 `lax` 或 `iad`。

## Step 3 — 创建 Fly Postgres（独立 service）

```bash
fly postgres create \
  --name zhouyi-db \
  --region sin \
  --vm-size shared-cpu-1x \
  --volume-size 1
```

**记下输出里的**：
- `Database URL`（含密码）—— 之后 `fly secrets set` 用
- `Host` / `Port` / `User` —— 之后 attach 用

数据库会停在启动状态，attach 之后才连。

## Step 4 — 把 Postgres attach 到 app

```bash
fly postgres attach zhouyi-db --app zhouyi-yourname-2026
```

**自动**：
- 把 `DATABASE_URL` 注入 app 的 secrets（Express 启动时读得到）
- 在 Fly 内部网络开通 app↔db 连接

## Step 5 — 设置其他 secrets

```bash
# 1. Anthropic API key（AI 解读必填）
fly secrets set ANTHROPIC_API_KEY=sk-ant-... --app zhouyi-yourname-2026

# 2. JWT secret（生成一个 32 字符的随机串）
JWT=$(openssl rand -hex 32)
fly secrets set JWT_SECRET=$JWT --app zhouyi-yourname-2026

# 3. FRONTEND_ORIGIN（先填 Fly 默认域名，之后换自定义域）
fly secrets set FRONTEND_ORIGIN=https://zhouyi-yourname-2026.fly.dev --app zhouyi-yourname-2026
```

> **不要把 secrets commit 到 git**。`fly secrets set` 写入 Fly 平台的加密 secret store。

## Step 6 — 首次部署

```bash
# 还在项目根目录
fly launch --no-deploy
#  会：
#  - 检测到 Dockerfile，复制它
#  - 创建 .fly/ 目录（gitignore 已有）
#  - 不会自动 deploy（因为 --no-deploy）

# 第一次 build + deploy
fly deploy
```

**首次 deploy 通常 3-5 分钟**（拉 base image、装 deps、Vite build、tsc build、push image、boot machine）。

**会看到的进展**：
```
==> Building image
[+] Building 142.4s (24/24) FINISHED
==> Pushing image to Fly registry
==> Creating release
--> v0 created
==> Monitoring deployment
1 desired, 1 placed, 1 healthy, 0 unhealthy [health check: 1 total]
✓ Deploy done
```

## Step 7 — Smoke test

```bash
# 拿 URL
fly info --app zhouyi-yourname-2026

# 健康检查
curl -sf https://zhouyi-yourname-2026.fly.dev/health
# 期望: "OK" 或类似

# 主页
curl -sI https://zhouyi-yourname-2026.fly.dev/
# 期望: HTTP/2 200

# 浏览器打开
# https://zhouyi-yourname-2026.fly.dev
# 应该看到首页（今日卦境）
```

## Step 8 — 持续部署

**方式 A：手动**
```bash
git push origin main   # 本地 main 已经更新
fly deploy             # 触发 build + deploy
```

**方式 B：自动（GitHub Actions，可选）**

Fly 官方有 GitHub Action（`flyctl-actions/deploy`）。在 `.github/workflows/deploy.yml` 写：

```yaml
name: Deploy to Fly
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - name: Deploy
        run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

需要在 GitHub repo settings → Secrets 加 `FLY_API_TOKEN`（在 `fly auth token` 拿）。

## 自定义域名（可选，但推荐）

### 9.1 买域名

`易象阁.com` / `zhouyi.app` / 任意你喜欢的。Cloudflare Registrar 是 $10/年 .com（不收溢价）。

### 9.2 加域名到 Fly

```bash
fly certs create yourdomain.com --app zhouyi-yourname-2026
fly certs create www.yourdomain.com --app zhouyi-yourname-2026
```

Fly 给你一个 CNAME target（形如 `zhouyi-yourname-2026.fly.dev`）。

### 9.3 DNS 设

在你域名 registrar（Cloudflare / Namecheap / 阿里云）加：

```
yourdomain.com     CNAME  zhouyi-yourname-2026.fly.dev
www.yourdomain.com  CNAME  zhouyi-yourname-2026.fly.dev
```

DNS 生效后 Fly 自动签发 Let's Encrypt 证书。

### 9.4 改 FRONTEND_ORIGIN

```bash
fly secrets set FRONTEND_ORIGIN=https://yourdomain.com --app zhouyi-yourname-2026
fly deploy
```

## Cloudflare 套前面（CDN/DDoS 防护）

把 Cloudflare 当 DNS + CDN + SSL 层（白嫖）：

1. Cloudflare 加站点，NS 改到你域名 registrar
2. SSL/TLS → Full (strict)
3. Speed → Auto Minify (JS/CSS/HTML)
4. Caching → Standard
5. Page Rules: `yourdomain.com/api/*` → Cache Level: Bypass
6. Workers → 不要

API 流量绕过 CDN（避免 SSE 流被缓存），HTML/JS/CSS 走 CDN 边缘。

## 监控

```bash
fly logs --app zhouyi-yourname-2026         # 实时日志
fly status --app zhouyi-yourname-2026       # 机器状态
fly metrics --app zhouyi-yourname-2026      # CPU/mem/带宽
```

推荐设：Fly dashboard → Settings → Notifications → 邮件告警（machine down / 错误率超阈值）。

## 故障排查

| 症状 | 可能原因 | 排查 |
|---|---|---|
| Deploy 成功但 health 502 | Express 没启动 / DB 连不上 | `fly logs`，看启动时是否 `DATABASE_URL` 解析到 Fly 内网 |
| 首页 404 | SPA fallback 没生效 / dist 没 copy | `fly ssh console` 进容器看 `/app/dist` 是否存在 `index.html` |
| CORS 错 | `FRONTEND_ORIGIN` 没配 / 配错 | `fly secrets list` 看，`curl -H "Origin: https://yourdomain" -I .../api/ai/...` 看 `Access-Control-Allow-Origin` 头 |
| AI 解读 401/500 | `ANTHROPIC_API_KEY` 没设或错 | `fly secrets list`，`fly logs \| grep anthropic` |
| Postgres 502 | attach 没成功 | `fly postgres list`，确认 `zhouyi-db` 是 `attached` 状态 |

## 成本估算（小流量 MVP）

- Fly Machine (shared-cpu-1x, 512MB) auto-stop: **$0/月**（空闲时 0 machine running）
- Fly Postgres 1GB: **$1.94/月**
- AI 解读 50 次/天 × $0.005: **~$7.50/月**
- 域名（可选）: **$10/年**
- Cloudflare: **$0**（free tier）

**起步月费 ~$9.5**，流量涨上去后机器 + DB 按用量。

## Rollback

```bash
fly releases --app zhouyi-yourname-2026    # 列历史
fly releases rollback v3                    # 回滚到 v3
```

Fly 保留历史 image，rollback 是秒级（重启到旧 image）。

## 备份

- **Postgres**: `fly postgres backup create --app zhouyi-db`（每日手动 / 配 cron）
- **64 卦 JSON**: 在 git 里，部署时 baked 进 image
- **用户记录**: 在 Postgres 里，备份跟着 PG 走
- **AI 解读缓存**: 在 Postgres 的 `ai_interpretation` 字段，跟着 PG 备份走

## 升级流程

```bash
git pull                   # 拉新代码
npm test                   # 本地先跑测试
fly deploy                 # 部署
fly releases status         # 确认新版本 healthy
fly releases rollback v3   # 失败立即回滚
```

---

## 关键文件清单

- `Dockerfile` — 多阶段镜像（frontend build → backend build → runtime）
- `.dockerignore` — 排除 node_modules / 测试 / docs
- `fly.toml` — Fly app 配置
- `server/src/app.ts` — 改了：production 模式 serve `dist/` + SPA fallback
- `server/.env.example` — 加了 Fly / 生产 notes
- `docs/deploy/fly-io.md` — 本文件
