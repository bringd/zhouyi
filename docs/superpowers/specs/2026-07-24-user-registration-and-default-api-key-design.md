# 用户注册 + 服务端默认 API Key 设计

**日期**: 2026-07-24
**状态**: Draft(待用户 review)
**作者**: brainstorming with user
**范围**: Phase 1 — 仅本地 dev 测试,不上远程

---

## 1. 目标 & 范围

### 1.1 一句话目标

让访客无需接触 API Key 即可使用 AI 解读,同时给"想要继续使用"的用户一条低门槛的实名(手机号)注册路径。

### 1.2 包含(In Scope)

| # | 能力 | 形态 |
|---|---|---|
| 1 | 游客默认 **1 次免费起卦**(包含 AI 解读) | 全本地 dev 链路 |
| 2 | 第 2 次起卦硬锁:必须先完成短信注册 | 硬锁,不绕过 |
| 3 | 短信注册:手机号 + 6 位验证码,MOCK 模式(console.log) | 无密码,token = session cookie |
| 4 | 已注册用户自动获得"服务端默认 API Key"访问 AI | **Key 在服务端,不在前端** |
| 5 | 服务端默认 Key 通过 `worker/.dev.vars`(本地)+ Cloudflare Pages Function `env.AI_DEMO_KEY`(未来生产) | 复用现有 Pages Function 模式 |
| 6 | 第 1 次注册用户的 quota 不再限 1 次 | 无限次 |

### 1.3 不包含(Out of Scope)

| # | 能力 | 原因 |
|---|---|---|
| 1 | 真实短信供应商(Twilio / 阿里云 / 腾讯云) | 本次 Mock 占位,留接口 |
| 2 | 登出 / 跨设备登录 / 找回密码 | 单 device + cookie 持久已够 |
| 3 | Email 注册 / OAuth(微信/Google/Apple) | 用户明确指定短信 |
| 4 | 修改默认 API Key 的 Web UI | 配置改 .dev.vars 即可 |
| 5 | 任何云端部署 | 用户明确"传云端前等我通知" |
| 6 | 迁移现有 guest 数据 | 兼容保留,见 §8 |

---

## 2. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│ 浏览器                                                       │
│                                                              │
│  src/pages/Divination.tsx                                    │
│    ├─ 提交前读 src/lib/quota.ts(新增)                        │
│    │     ├─ 模式 'guest' → remaining=1     ← 本地 localStorage│
│    │     └─ 模式 'registered' → remaining=∞  ← 改 backend 状态│
│    ├─ 0 时拦截 → 弹 SMS 注册模态(src/components/auth/SmsModal.tsx)    │
│    └─ 通过 → POST /api/records(无 x-api-key 头)              │
│                                                              │
│  src/lib/apiConfig.ts (基本不动)                             │
│    BYOK 仍保留底层,但本次 Settings UI 隐藏 BYOK 输入框       │
│    保留以便未来恢复 BYOK                                     │
│                                                              │
│  src/lib/auth.ts (新增)                                     │
│    状态机:{guest, registered, loading}                      │
│    通过 GET /api/auth/me 同步                                │
└─────────────────────────────────────────────────────────────┘
                            ↕ 同源 fetch
┌─────────────────────────────────────────────────────────────┐
│ Worker(本地 wrangler pages dev,D1 local)                    │
│                                                              │
│  worker/src/routes/auth.ts (新增)                            │
│   ├─ POST /api/auth/sms/send                                 │
│   │    { phone: 11位 → 校验、限频、生成 6 位 code            │
│   │      → 写入 sessions 表 smsPhone/smsCode/smsExpiresAt   │
│   │      → console.log('[SMS] code=<code> phone=<phone>')  │
│   │    } 返 200{ttl:300} (不返 code)                         │
│   └─ POST /api/auth/sms/verify                              │
│        { phone, code } → 校验未过期、未用、attempts<5        │
│        → 命中 → UPDATE users SET email=phone, passwordHash=  │
│               'sms' WHERE id = c.var.userId                 │
│        → UPDATE sessions SET smsCode=NULL(标记用掉)          │
│        → 返 200{userId, mode:'registered'}                  │
│                                                              │
│  worker/src/routes/records.ts (改)                          │
│   └─ POST /api/records 校验 quota,=0 返 402 quota_exceeded   │
│                                                              │
│  worker/src/routes/me.ts (新增)                              │
│   └─ GET /api/auth/me → { mode, remaining, userId }          │
│                                                              │
│  worker/src/db/schema.ts (改)                               │
│   └─ sessions 表加 3 列:                                    │
│        sms_phone text, sms_code text, sms_expires_at int,    │
│        sms_verify_attempts int default 0,                    │
│        sms_locked_until int                                  │
│                                                              │
│  worker/src/middleware/session.ts (轻改)                     │
│   └─ sessionMiddleware 解析出 c.var.mode + c.var.remaining   │
│      (guest/registered 来自 users.email)                     │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│ Pages Function(本地 wrangler pages dev 自动运行)             │
│  functions/api/proxy/anthropic/v1/messages.ts                │
│    ├─ 读 header x-api-key                                    │
│    ├─ 无 → 注入 env.AI_DEMO_KEY (从 .dev.vars 读)            │
│    └─ 转发给 upstream                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 端到端数据流(6 步)

### Step 1. 新访客进入
```
浏览器 GET /
  ├─ sessionMiddleware (worker)
  │   ├─ 无 zhouyi_session cookie
  │   ├─ randomId() 生成 sessionId
  │   ├─ INSERT users(id=uuid, email='guest-{uuid}@zhouyi.local',
  │   │                passwordHash='!', lastSeenAt=now)
  │   ├─ INSERT sessions(id, userId, refreshTokenHash=sessionId,
  │   │                  expiresAt=now+365d)
  │   └─ setCookie zhouyi_session (HttpOnly, SameSite=Lax, 1y)
  ├─ c.var.userId = 新 uuid
  └─ c.var.mode = 'guest', c.var.remaining = 1
```

### Step 2. 首次起卦(免费)
```
浏览器 POST /api/records { a, b, c }
  ├─ 前端: src/lib/quota.ts 读 remaining=1 → 允许
  ├─ Worker: middleware 校验 userId mode='guest' remaining=1
  │          → 通过
  ├─ 写入 records 表
  ├─ quota 计数 remaining = 0 (本地 localStorage)
  └─ 返回 200 { recordId } → 跳 /result/:id

结果页:用户点「AI 解读」
  ├─ POST /api/proxy/anthropic/v1/messages (无 x-api-key 头)
  │   ├─ Pages Function 检测:无 x-api-key → 注入 env.AI_DEMO_KEY
  │   ├─ 转发 upstream → 流式响应
  │   └─ 流回浏览器
  └─ 渲染 AI 解读
```

### Step 3. 第二次起卦(硬锁)
```
浏览器 POST /api/records
  ├─ 前端: src/lib/quota.ts 读 remaining=0
  │   → 不发起请求,弹 SMS 注册模态
  │   → 用户关闭模态:本次操作作废(no record, no AI call)
  │
  ├─ (绕前端 直 curl 不走前端)
  │   backend: middleware 校验 mode='guest' remaining=0
  │   → 返 402 { code:'quota_exceeded',
  │              action:'register_sms',
  │              trigger:'open_sms_modal' }
  └─ (兜底)即使前端绕过,后端也拒绝
```

### Step 4. 用户输入手机号
```
浏览器 POST /api/auth/sms/send { phone:'13800138000' }
  ├─ worker/src/routes/auth.ts
  │   ├─ 校验 ^1[3-9]\d{9}$ → 否则 400 invalid_phone
  │   ├─ 限频检查:
  │   │   ├─ 60s 内已发过 → 429 rate_limited + retryAfter
  │   │   └─ 1h 内已发 ≥5 次 → 429 too_many_attempts
  │   ├─ 6 位 code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
  │   ├─ UPDATE sessions SET smsPhone=phone, smsCode=code,
  │   │                       smsExpiresAt=now+5min,
  │   │                       smsVerifyAttempts=0,
  │   │                       smsLockedUntil=NULL
  │   │   WHERE refreshTokenHash = c.var.sessionId
  │   └─ console.log(`[SMS] code=${code} phone=${phone} ttl=300s`)
  └─ 返 200 { ttl: 300, message: '验证码已发送' }
```

### Step 5. 用户输入验证码
```
浏览器 POST /api/auth/sms/verify { phone:'13800138000', code:'482910' }
  ├─ auth.ts
  │   ├─ 查 sessions WHERE refreshTokenHash=c.var.sessionId
  │   │   └─ miss → 401 session_expired
  │   ├─ 校验 smsPhone == phone,smsCode == code
  │   │   └─ 不匹配 → 401 invalid_code
  │   ├─ 校验 smsExpiresAt > now
  │   │   └─ 过期 → 401 invalid_code,清 smsCode
  │   ├─ 校验 smsLockedUntil IS NULL OR < now
  │   │   └─ 锁定中 → 401 too_many_attempts
  │   ├─ 校验 smsVerifyAttempts < 5
  │   │   └─ ≥5 → UPDATE smsLockedUntil = now+1h,返 401 too_many_attempts
  │   ├─ 命中:
  │   │   ├─ UPDATE users SET email=phone,
  │   │   │                   passwordHash='sms',
  │   │   │                   updatedAt=now
  │   │   │    WHERE id = c.var.userId
  │   │   ├─ UPDATE sessions SET smsCode=NULL,
  │   │   │                       smsExpiresAt=NULL,
  │   │   │                       smsVerifyAttempts=0,
  │   │   │                       smsLockedUntil=NULL
  │   │   └─ c.var.mode = 'registered', remaining = ∞
  │   └─ 返 200 { userId, mode:'registered' }
  └─ 前端: src/lib/auth.ts 收到 → 状态机转入 registered
        关闭模态,允许再发起卦
```

### Step 6. 后续起卦(注册后)
```
浏览器 POST /api/records
  ├─ 前端: quota.mode='registered' → remaining=∞ → 放行
  ├─ Worker: middleware 校验 mode='registered' → 跳过 quota
  ├─ 写入 records 表
  └─ AI 解读:POST /api/proxy/anthropic/v1/messages (无 x-api-key)
      → Pages Function 注入 env.AI_DEMO_KEY → 转发
```

---

## 4. API 契约

### 4.1 POST /api/auth/sms/send

**Request**:
```json
{ "phone": "13800138000" }
```

**Response 200**:
```json
{ "ttl": 300, "message": "验证码已发送" }
```

**Errors**:
| Status | Code | 触发条件 |
|---|---|---|
| 400 | `invalid_phone` | 不匹配 `^1[3-9]\d{9}$` |
| 429 | `rate_limited` | 60s 内已发 |
| 429 | `too_many_attempts` | 1h 内已发 ≥5 次 |
| 503 | `sms_disabled` | (预留)真实 provider 不可用 |

### 4.2 POST /api/auth/sms/verify

**Request**:
```json
{ "phone": "13800138000", "code": "482910" }
```

**Response 200**:
```json
{ "userId": "uuid", "mode": "registered" }
```

**Errors**:
| Status | Code | 触发条件 |
|---|---|---|
| 400 | `invalid_phone` | 格式错 |
| 401 | `invalid_code` | 码错 / 过期 / 已用 |
| 401 | `too_many_attempts` | 5 次错误已锁 1h |
| 401 | `session_expired` | session 找不到 |

### 4.3 GET /api/auth/me

**Response 200**:
```json
{
  "userId": "uuid",
  "mode": "guest" | "registered",
  "remaining": 1 | null
}
```

### 4.4 POST /api/records (改)

**入参不变**(原有 `a/b/c` 三数起卦 或 daily 类型)

**新增 402 错误**:
```json
{
  "code": "quota_exceeded",
  "message": "请先注册以继续使用",
  "action": "register_sms",
  "trigger": "open_sms_modal"
}
```

### 4.5 POST /api/proxy/anthropic/v1/messages (不动)

完全沿用现有 Pages Function 行为:
- 有 `x-api-key` 头 → 透传(本次无人用,保留)
- 无 → 注入 `env.AI_DEMO_KEY`

---

## 5. 状态机

```
        ┌──────────────┐
        │   guest      │ ← 默认,新访客
        │ remaining:1  │
        │ mode:'guest' │
        └──────┬───────┘
               │ POST /api/auth/sms/verify 成功
               ▼
        ┌──────────────┐
        │  registered  │ ← 后续无限
        │ remaining:∞  │  mode:'registered'
        └──────────────┘
               │
               │ (本次不做) 登出 / 注销 → 重回 guest
```

**判定来源**:
- `mode='guest'` ⇔ `users.email LIKE 'guest-%@zhouyi.local'`
- `mode='registered'` ⇔ `users.email` 是 11 位手机号
- 后端 `remaining`:
  - `mode='registered'` → `null`(无限)
  - `mode='guest'` → `1 - COUNT(records WHERE userId = c.var.userId)`,限到 `[0, 1]`
- 前端 `remaining`(乐观值,用于 UX 拦截):
  - `mode='guest'` → localStorage `zhouyi:quota:divination` 字段
  - `mode='registered'` → `null`
  - 初始化时从 `/api/auth/me` 拉一次,后续本地维护

**前端 vs 后端 remaining 的关系**:
- **后端权威**:通过 records count 决定,防止 curl 绕过
- **前端友好**:UI 提前拦截,减少 402 报错
- 两者脱节场景:用户清 localStorage 但 records 还在 → 前端显示 "1 free" 但后端立刻 402
- 这种情况**可以接受**:用户体验略不完美,但不破坏安全

---

## 6. 错误处理矩阵

| 场景 | 检测位置 | 行为 |
|---|---|---|
| 手机号格式错 | `auth.ts:send` | 400 `invalid_phone` |
| 60s 内重发 | `auth.ts:send` (查 `sessions.smsExpiresAt`) | 429 `rate_limited` + `retryAfter` |
| 1h 内 5 次 | `auth.ts:send` (查 sessions 历史) | 429 `too_many_attempts` |
| 验证码过期 (>5min) | `auth.ts:verify` | 401 `invalid_code`,清 smsCode |
| 验证码输错 | `auth.ts:verify` | 401 + `smsVerifyAttempts++` |
| 5 次错误尝试 | `auth.ts:verify` | `smsLockedUntil = now+1h`,返 401 `too_many_attempts` |
| 验证码已用 | `auth.ts:verify` (smsCode IS NULL) | 401 `invalid_code` |
| 手机号不匹配 session | `auth.ts:verify` | 401 `invalid_code` |
| session 找不到 | `auth.ts:verify` | 401 `session_expired`(理论上不会发生) |
| 起卦 quota=0 | `records.ts` 路由 | 402 `quota_exceeded` |
| 直 curl 绕过前端 | `records.ts` middleware | 同样 402 |
| AI Key 未配置 | 启动时 `import` 检测 | 启动报错「请在 .dev.vars 配置 AI_DEMO_KEY」 |
| 上游 5xx | Pages Function | 透传 status code,前端按现有 `ai.ts` 错误处理 |
| 上游 429 | Pages Function | 透传 |

---

## 7. 安全考虑

### 7.1 默认 API Key 流转路径(关键)

**寻址链**:
```
worker/.dev.vars (gitignored,本地)
  └─ AI_DEMO_KEY = sk-ant-...真实值
        ↓ wrangler pages dev 自动加载
Pages Function env.AI_DEMO_KEY
        ↓ 仅当请求无 x-api-key 头
Upstream 请求注入
```

**Risk Points**:
1. `worker/.dev.vars` 必须 gitignore(确认 ✅,在 `.gitignore` 已有 `.dev.vars`)
2. `.dev.vars` 文件名:Cloudflare 标准,Wrangler 自动加载
3. 真实生产值**绝不**入库 `wrangler.toml`、前端 `.env`、前端 `.env.example`
4. `.env.example` 只放占位 `AI_DEMO_KEY=sk-your-key-here` 注释

### 7.2 验证码暴力破解

- 6 位数字 = 10^6 = 100 万种
- 限频:60s 1 次 + 1h 5 次 + 5 次错锁 1h → 实际每秒最多试 1/60 ≈ 0.017 次
- 1h 内最多试 5 次 → 期望破解时间 = 100万 / 5 / 24h ≈ 2000 天
- 加上 `smsPhone` 与 `smsCode` 绑定 → 跨手机号码无效
- 加上 `smsLockedUntil` 熔断 → 暴力破解不经济

### 7.3 Session 伪造

- `zhouyi_session` cookie 是 HttpOnly + SameSite=Lax + 1y 有效期
- cookie 值 = sessionId = refreshTokenHash(在 `sessions` 表)
- 攻击者无法 XSS(read cookie) 或 CSRF(POST 跨域)
- 即使拿到 sessionId,只能调用该用户已注册的 quota(因为 records/divination 都靠 `c.var.userId`)

### 7.4 验证码泄漏

- 当前 dev 模式直接 `console.log` 明文验证码
- 仅本机能见,生产环境必须切真实 provider + 真实 provider 已加密
- 留 TODO:接 real provider 时,`console.log` 包在 `if (env.ENVIRONMENT === 'dev')` 内

### 7.5 已有 BYOK 用户

- 我们不删除 `src/lib/apiConfig.ts` 的 BYOK 逻辑
- Settings UI **隐藏** BYOK 输入(本次)
- 未来若想恢复:取消隐藏即可,代码不动

---

## 8. 迁移 / 兼容性

### 8.1 现有数据

| 已有数据 | 行为 |
|---|---|
| 现有 guest `users` rows | 保留不动,字段不动 |
| 现有 `records` linked to guest userId | 保留不动,自动跟随 |
| 现有 `favorites` linked to guest userId | 保留不动,自动跟随 |
| 现有 `sessions` 表 | 加 4 列新字段,默认 NULL |

### 8.2 Schema 迁移

新加 column 到 `sessions` 表:
```sql
ALTER TABLE sessions
  ADD COLUMN sms_phone text,
  ADD COLUMN sms_code text,
  ADD COLUMN sms_expires_at integer,
  ADD COLUMN sms_verify_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN sms_locked_until integer;
```

D1 migration 文件:`worker/src/db/migrations/0002_sms_auth_fields.sql`

### 8.3 升级路径

- 访客(已有 session)完成 SMS 验证 → UPDATE users SET email=phone WHERE id = c.var.userId
- records 自然跟随(同一个 userId)
- 不删除任何数据
- 旧 records 在 records 表,userId 不变

### 8.4 不删除 BYOK

`src/lib/apiConfig.ts` 不动。前端 Settings UI 临时隐藏 BYOK 区块。
未来想恢复:把 Settings 页 BYOK section 的 `hidden` class 去掉即可。

---

## 9. 测试策略

### 9.1 新增测试文件

| 文件 | 类型 | 关键 case |
|---|---|---|
| `tests/lib/quota.test.ts` | 纯单元 | 初始 1、消费→0、registered → null、reset() |
| `tests/lib/auth.test.ts` | 纯单元 | state 转换、cookie 持久化、模式切换 |
| `tests/worker/auth.test.ts` | 集成(miniflare) | send/verify 正则、限频、过期、5 次错锁、模式升级 |
| `tests/worker/records-quota.test.ts` | 集成(miniflare) | guest 0 → 402,registered 跳过 quota |
| `tests/worker/me.test.ts` | 集成(miniflare) | /auth/me 模式返回 |
| `tests/lib/SmsModal.test.tsx` | 组件 | 短信两步流程、错误码翻译 |
| `tests/lib/DivinationQuota.test.tsx` | 组件 | 起卦按钮拦截、modal 触发 |

### 9.2 回归测试

- `npm test` 现有 262 个用例全部通过
- 加新 7 个文件后预计 270+ 用例
- `npm run typecheck` 0 错误
- `npm run build` exit 0

### 9.3 Manual 验证(本地)

按 §10 启动流程跑通下列路径:
1. 全新访客 → 1 次起卦 → AI 解读
2. 第 2 次 → 拦截 → 弹 SMS 模态
3. 模态输手机号 → 看 console 6 位码
4. 输错码 → 401 + attempts +1
5. 输对码 → 200 → 模态关闭
6. 再发起卦 → 通过 + AI 解读
7. 刷新页面 → 仍是 registered
8. `.dev.vars` 缺 AI_DEMO_KEY → 启动报错

---

## 10. 部署 / 本地 dev 流程

### 10.1 一次性 .dev.vars 配置

```bash
# worker/.dev.vars(已 gitignored,确认)
cat >> worker/.dev.vars <<EOF
AI_DEMO_KEY=sk-ant-your-real-key-here
EOF
```

### 10.2 D1 migration

```bash
cd worker
npx wrangler d1 migrations apply zhouyi-db --local
```

### 10.3 启动(三个进程并行)

**前置阅读**:`vite.config.ts` 当前已有 proxy:
- `/api-proxy/*` → `https://api.minimaxi.com`(直连 byok 路径,本次不再用)
- `/api-feed/*` → `http://localhost:8787`(Worker 路由)

**本次新增 proxy**(需改 `vite.config.ts`):
- `/api/auth/*` → `http://localhost:8787`(Worker,send/verify/me)
- `/api/records` / `/api/favorites` → `http://localhost:8787`(Worker)
- `/api/proxy/anthropic/*` → `http://localhost:8788`(Pages Function)

**启动命令**:
```bash
# 终端 1:Pages Function(AI 代理 + D1 local)
cd D:/eight
npx wrangler pages dev --compatibility-date=2025-04-01 --d1=DB=zhouyi-db
# → http://localhost:8788
# 自动读 functions/、worker/.dev.vars(AI_DEMO_KEY)

# 终端 2:Worker(auth/records/me/feed 路由)
cd D:/eight/worker
npm run dev
# → http://localhost:8787

# 终端 3:Vite 前端
cd D:/eight
npm run dev
# → http://localhost:5173
# 浏览器开 :5173,所有 /api/* 由 Vite 代理到 8787/8788
```

**为什么不只跑 wrangler pages dev**:
- Pages Function 只处理 `/api/proxy/anthropic/*`,Worker 路由(records/auth/me)需要单独跑
- 三进程并行已经是标准 Cloudflare dev 实践

### 10.4 不做的事

- ❌ 不 push 到 git remote
- ❌ 不部署到 Cloudflare Pages
- ❌ 不部署到 Worker
- ❌ 不改 `docs/deploy/cloudflare-pages.md`(那是另 task #14)

---

## 11. 验收清单

下方是用户可手动验证的 checklist,实现完成时逐项打勾:

- [ ] 全新访客(无 cookie)进入站点 → 自动有 guest session + remaining=1
- [ ] 完成 1 次起卦 → Result 页正常,quota 变 0
- [ ] 第 2 次提交起卦:前端拦截 + 弹 SMS 模态
- [ ] 直 curl `POST /api/records` 绕过前端 → 同样 402 quota_exceeded
- [ ] 模态输 11 位手机号 → wrangler console 输出 6 位码 → 前端显示"已发送"
- [ ] 同码 60s 内重发 → 429 + retry-after 提示
- [ ] 输错码 → 401 + attempts 计数 +1
- [ ] 5 次错码 → 锁 1 小时
- [ ] 等 5 分钟再用同码 → 401 invalid_code
- [ ] 输对码 → 200 { mode:'registered' } → 模态关闭
- [ ] 再发起卦 → 不被拦 → AI 走默认 key
- [ ] 关闭浏览器再开 → 仍是 registered(cookie 持久)
- [ ] `.dev.vars` 缺 `AI_DEMO_KEY` → 启动报错「请配置 AI_DEMO_KEY」,不静默失败
- [ ] `npm test` 全绿(270+ 用例)
- [ ] `npm run typecheck` 0 错误
- [ ] `npm run build` exit 0

---

## 12. 风险 & 缓解

| 风险 | 严重度 | 缓解 |
|---|---|---|
| `console.log` 验证码在生产泄漏 | H(本次=L) | 留 `SMS_PROVIDER` 抽象,生产时切真实 provider,console 包在 `if (env.ENVIRONMENT === 'dev')` |
| `sessions` 表 `smsVerifyAttempts` 频繁 UPDATE → D1 IO 压力 | M | 5min 滑动窗口 + `UPDATE ... WHERE attempts < 5 LIMIT 1` 条件更新 |
| `vite.config.ts` 已有的 `/api-feed` proxy 与本次 `/api/*` 路径冲突 | M | 验证 proxy 列表,新增 `/api/auth/*`、保留 `/api-feed` |
| 现有 BYOK 用户预期"还能用 Settings 填 key" | L | 文档 + commit message 说明「本期隐藏 BYOK UI,功能底层保留」 |
| `worker/src/middleware/session.ts` 改 mode/remaining 计算需重启 session | M | 写 cleartext 注释:升级时刷新页面 |
| `worker/.dev.vars` 路径 vs `worker/.dev.vars.local` 命名 | L | 仅 `.dev.vars` 即可,Wrangler 默认读 |
| 11 位手机号 strict 校验 → 1 个用户用 +86 前缀失败 | L | 后续加前缀宽容;本次明确文档要求只输 11 位 |
| 没有真实 provider 时无法冒烟测试 | M | 文档说「看 console 拿码」 |

---

## 13. 文档 / 文件清单

### 13.1 新增文件

| 文件 | 用途 |
|---|---|
| `src/lib/quota.ts` | 设备配额计数 |
| `src/lib/auth.ts` | 客户端 auth 状态机 |
| `src/components/auth/SmsModal.tsx` | 短信两步模态(从 Divination 拦截时弹出) |
| `worker/src/routes/auth.ts` | POST /api/auth/sms/send, /verify |
| `worker/src/routes/me.ts` | GET /api/auth/me |
| `worker/src/db/migrations/0002_sms_auth_fields.sql` | D1 schema 加列 |
| `tests/lib/quota.test.ts` | quota 单元测试 |
| `tests/lib/auth.test.ts` | auth 状态机测试 |
| `tests/worker/auth.test.ts` | auth 路由集成测试 |
| `tests/worker/records-quota.test.ts` | records quota 集成测试 |
| `tests/worker/me.test.ts` | me 路由测试 |
| `tests/lib/SmsModal.test.tsx` | SmsModal 组件测试 |
| `tests/lib/DivinationQuota.test.tsx` | Divination quota 拦截测试 |

### 13.2 改动文件

| 文件 | 改动 |
|---|---|
| `worker/src/db/schema.ts` | sessions 表加 5 列 |
| `worker/src/middleware/session.ts` | 解析 c.var.mode、c.var.remaining |
| `worker/src/routes/records.ts` | quota=0 时返 402 |
| `src/pages/Divination.tsx` | 提交前读 quota,0 时拦截 → 弹 SmsModal |
| `src/pages/Settings.tsx` | 隐藏 BYOK 输入框(本期) |
| `.env.example` | 删 VITE_DEFAULT_AI_API_KEY,加 `AI_DEMO_KEY` 注释 |
| `vite.config.ts` | 加 3 个新 proxy:`/api/auth/*`、`/api/records`、`/api/proxy/anthropic/*` |

### 13.3 不动文件

- `src/lib/apiConfig.ts` — BYOK 逻辑保留
- `functions/api/proxy/anthropic/v1/messages.ts` — 完全不动
- `src/lib/ai.ts` — 完全不动
- `package.json` — 不加新依赖

---

## 14. 开放问题 / 未来工作

| 议题 | 状态 |
|---|---|
| 真实 SMS provider 接入 | TODO,留 phase 2 |
| 跨设备登录(同手机号 2nd device) | TODO,需要 sign-in 流程 |
| 修改默认 API Key 的 Web UI | TODO,本期 .dev.vars 手动 |
| Email 注册 / OAuth | TODO,本期不混 |
| 登出 / 注销 | TODO,本期不混 |
| 全局 cookie 清理(privacy consent) | TODO,与 spec 1.3 隐私相关 |
| 验证码尝试 metrics 上报 | TODO,生产化时再做 |
| 自适应 quota(guest 用户每日 +1 而非 total 1) | TODO,产品决策 |

---

## 附录 A. 关键决策摘要

| 决策 | 选择 | 替代方案 |
|---|---|---|
| 注册方式 | 短信(11 位中国手机号) | Email / OAuth |
| 验证码长度 | 6 位数字 | 4 位 / 8 位 |
| 验证码 TTL | 5 分钟 | 1 分钟 / 10 分钟 |
| 验证错误上限 | 5 次锁 1 小时 | 3 次 / 10 次 |
| 限频策略 | 60s 1 次 + 1h 5 次 | 30s / 5min |
| 1 次免费 quota | 计在本设备 localStorage | 计在 session / IP |
| 默认 API Key 位置 | 服务端 `.dev.vars` / `env.AI_DEMO_KEY` | 前端 .env (已弃) |
| 升级路径 | 同一 userId 升级 users.email | 新建 userId + 迁移 records |
| 部署阶段 | 仅本地 dev | 远程同步部署 |
| 真 SMS provider | 本次 Mock (console) | Twilio / 阿里云 |

## 附录 B. 字段约束

```ts
// src/lib/quota.ts
type QuotaState =
  | { mode: 'guest'; remaining: 1 | 0 }
  | { mode: 'registered'; remaining: null }

// src/lib/auth.ts
type AuthState =
  | { status: 'loading' }
  | { status: 'guest'; userId: string }
  | { status: 'registered'; userId: string; phone: string }

// worker/src/routes/auth.ts
interface SendSmsRequest { phone: string }
interface SendSmsResponse { ttl: 300; message: string }
interface VerifySmsRequest { phone: string; code: string }
interface VerifySmsResponse { userId: string; mode: 'registered' }
```

---

**End of Spec**
