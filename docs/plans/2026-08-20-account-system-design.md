# 易象阁账号系统设计（用户名 + 密码）

日期：2026-08-20
状态：设计已确认，待实施
方案：增量演进（方案一）——在现有 guest session 架构上叠加用户名密码层

---

## 一、需求决定

| 项 | 决定 |
|---|---|
| 认证方式 | 用户名 + 密码；短信/邮箱字段预留，本期不启用验证 |
| 访客模式 | 保留，不登录可用全部功能 |
| 功能范围 | 注册 / 登录 / 登出 / 改密 / 改昵称 |
| 明确不做（本期） | 注销账号、云端同步占卜记录、真实短信/邮箱通道、OAuth/微信登录 |
| SMS 旧代码 | 删除实现（路由 + SmsModal + sessions.sms_* 列），schema 预留 phone/email 列 |
| 用户名 | 中文/英文/数字/下划线，2-16 字符，全站唯一（英文大小写不敏感），注册后不可改 |
| 昵称 | 1-16 字符，可改，可重复 |
| 前端入口 | 顶栏按钮/头像 + 弹窗；账号管理收进设置页 |
| 安全基线 | 极简：仅密码哈希 + Cookie Secure 标志（用户明确指示，其余安全项记为债务） |

---

## 二、数据模型与迁移（migration 0003）

### 2.1 重建 `users` 表

SQLite 无法原地修改 `email NOT NULL` 约束，走标准 12-step rebuild，事务内执行，现有 guest 数据全量迁移。

生产现状：SMS 为 mock，生产不存在真实 registered 用户，users 表全是 guest，无历史数据包袱。

```sql
-- 0003_account_system.sql（事务内）
CREATE TABLE users_new (
  id            TEXT PRIMARY KEY,
  status        TEXT NOT NULL DEFAULT 'guest' CHECK (status IN ('guest','registered')),
  username      TEXT,                          -- guest 为 NULL
  password_hash TEXT NOT NULL DEFAULT '!',     -- registered: PBKDF2 自描述格式
  phone         TEXT,                          -- 预留，本期全 NULL
  email         TEXT,                          -- 预留，本期全 NULL
  nickname      TEXT,
  region        TEXT,
  timezone      TEXT,
  last_seen_at  INTEGER,
  visit_count   INTEGER NOT NULL DEFAULT 1,
  user_agent    TEXT NOT NULL DEFAULT '',
  accept_language TEXT NOT NULL DEFAULT '',
  ip_address    TEXT NOT NULL DEFAULT '',
  first_referer TEXT,
  last_referer  TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

INSERT INTO users_new (id, status, password_hash, nickname, region, timezone,
  last_seen_at, visit_count, user_agent, accept_language, ip_address,
  first_referer, last_referer, created_at, updated_at)
SELECT id, 'guest', password_hash, nickname, region, timezone,
  last_seen_at, visit_count, user_agent, accept_language, ip_address,
  first_referer, last_referer, created_at, updated_at
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX users_username_idx ON users(username COLLATE NOCASE);
CREATE UNIQUE INDEX users_phone_idx    ON users(phone);
CREATE UNIQUE INDEX users_email_idx    ON users(email);
CREATE INDEX users_last_seen_idx       ON users(last_seen_at);
```

### 2.2 清理 `sessions` 表 SMS 字段

```sql
ALTER TABLE sessions DROP COLUMN sms_phone;
ALTER TABLE sessions DROP COLUMN sms_code;
ALTER TABLE sessions DROP COLUMN sms_expires_at;
ALTER TABLE sessions DROP COLUMN sms_verify_attempts;
ALTER TABLE sessions DROP COLUMN sms_locked_until;
DROP INDEX sessions_sms_phone_idx;
```

### 2.3 关键变化

1. **废弃 email 正则判 guest**——改用显式 `status` 列，`guest-<sid>@zhouyi.local` 假邮箱退场
2. 旧 `users.email` 列中的手机号（mock 时代测试数据）不迁移，直接丢弃
3. `records` / `favorites` / `shared_posts` 的 FK 指向表名 `users`，rebuild 后不受影响
4. `sessions.refresh_token_hash` 列保留，本期仍存 cookie 原值（哈希化列为债务）

---

## 三、API 与认证流程

### 3.1 端点清单

全部挂 `/api/auth/*`，沿用现有 Hono router。

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | `/register` | 注册（guest 原地升级） | guest |
| POST | `/login` | 登录（session 指向已有用户） | 任意 |
| POST | `/logout` | 登出（回到匿名 guest） | 任意 |
| PATCH | `/password` | 改密 | registered |
| PATCH | `/nickname` | 改昵称 | registered |
| GET | `/me` | 扩展为 `{ userId, mode, username?, nickname? }` | 任意 |

### 3.2 流程定义

**注册 = guest 原地升级**：
`UPDATE users SET status='registered', username=?, password_hash=? WHERE id=当前guest`。
guest 期间的社区帖子、数据全部保留，零孤儿。用户名冲突由 NOCASE 唯一索引兜底（并发安全）→ 409 `username_taken`。

**登录 = session 改指**：
查用户（username NOCASE）→ PBKDF2 校验 → 成功后 `sessions.userId` 指向目标用户。原 guest 用户行遗弃（与现有 SMS 流程一致，不做数据合并；guest 发过的帖子仍在，作者显示"访客"）。本期不做 session 轮换。

**登出 = 回到匿名**：
删当前 session 行 → 铸新 guest 用户 + session → Set-Cookie。保持"永远是 guest"的系统不变量。

**改密**：
验证旧密码 → 更新 hash。本期不踢其他设备（记为债务）。

**改昵称**：
校验 1-16 字符 → `UPDATE users SET nickname`。

### 3.3 错误形状

统一 `{ code, message }`：

| code | HTTP | 场景 |
|---|---|---|
| `invalid_username` | 400 | 用户名格式不合法 |
| `weak_password` | 400 | 密码长度不合法 |
| `username_taken` | 409 | 用户名已存在 |
| `invalid_credentials` | 401 | 登录失败（不区分用户不存在/密码错） |
| `wrong_password` | 401 | 改密时旧密码错误 |
| `guest_forbidden` | 403 | guest 调用改密/改昵称 |
| `invalid_nickname` | 400 | 昵称格式不合法 |

### 3.4 校验规则

- 用户名：2-16 字符（`Array.from` 计 Unicode 长度），`^[\u4e00-\u9fa5a-zA-Z0-9_]+$`
- 密码：8-128 位，无复杂度要求
- 昵称：1-16 字符（trim 后），可重复

---

## 四、极简安全基线

用户明确指示：安全暂不重点考虑，注册流程尚不完整，用最简单方式实现。仅保留两项：

1. **密码哈希**——PBKDF2-SHA256（Web Crypto 原生，零依赖）
   - 210k 迭代、16 字节随机 salt、256-bit 派生
   - 存储格式自描述：`pbkdf2$210000$<salt_b64>$<hash_b64>`，将来可换算法
   - 实施时基准测试 Workers CPU 耗时；若超限额，降迭代或换 `@node-rs/argon2` WASM
2. **Cookie 加 `Secure` 标志**——`HttpOnly; Secure; SameSite=Lax; Path=/`

**明确砍掉（记为债务）**：登录限流、session 轮换、session 过期校验、token 哈希存储、中间件写放大修复、CSRF token、注册限流、废弃 guest 行清理。

---

## 五、前端 UI

### 5.1 顶栏入口（PageLayout 右侧）

- guest：「登录」文字按钮
- registered：头像圆（用户名首字符）→ 下拉：昵称、设置、登出

### 5.2 AuthModal 弹窗

重写 `SmsModal` 位置的内容（删除 SmsModal）：
- 登录 / 注册两个 tab
- 登录：用户名 + 密码
- 注册：用户名 + 密码 + 确认密码
- 错误显示服务端 `code` 对应中文文案
- 成功 → 关弹窗，刷新 auth 状态

### 5.3 设置页「账号」区块（仅 registered 可见）

- 用户名（只读）
- 改昵称：输入框 + 保存
- 改密码：旧密码 + 新密码 + 确认
- 登出按钮

### 5.4 `src/lib/auth.ts` 重写

```ts
type AuthState =
  | { status: 'loading' }
  | { status: 'guest'; userId: string }
  | { status: 'registered'; userId: string; username: string; nickname: string | null }
```

导出：`refreshAuth()` / `login()` / `register()` / `logout()` / `changePassword()` / `changeNickname()`。删除全部 phone 相关逻辑。

### 5.5 部署打通（关键）

现状：生产 `/api/auth/*` 不可达（Pages 无对应 Function，请求落回 SPA）。
方案：与 `feed.ts` 对齐——统一 Worker base URL（生产硬编码 `https://zhouyi-worker.bringd.workers.dev`，dev 走 Vite 代理），auth 请求 `credentials: 'include'` 跨域调用，CORS 白名单已就绪。

---

## 六、测试、实施顺序与部署

### 6.1 测试

Worker 侧（vitest-pool-workers，`tests/worker/`）：
- `auth.test.ts` 重写：注册/登录/登出/改密/改昵称 + 校验错误分支
- `me.test.ts` 更新：新响应形状
- `session-middleware.test.ts` 更新：mode 由 `status` 列推导，删 SMS 用例
- `migration.test.ts` 更新：0003 断言（username NOCASE 唯一、sms_* 列消失、guest 数据保留）

前端侧（Vitest）：
- `tests/lib/auth.test.ts` 新增
- AuthModal 组件测试

### 6.2 实施顺序

- **PR-A（Worker）**：migration 0003 + schema.ts + PBKDF2 工具 + auth 路由重写 + 删 SMS 路由 + 测试
- **PR-B（前端）**：auth.ts 重写 + AuthModal + 顶栏入口 + 设置页账号区块 + 删 SmsModal + 测试

### 6.3 部署顺序

1. PR-A：先 `wrangler d1 migrations apply zhouyi-db --remote`，紧接着 `wrangler deploy`
   - 新代码依赖 `status` 列，必须先迁移
   - 窗口期无害：迁移后旧 Worker 把 guest 误判为 registered（email 变 NULL），但生产无功能消费 `mode`，用户无感
2. PR-B：push main → Pages 自动部署，auth UI 上线指向 Worker

本地开发：三进程架构不变，Vite 已有 `/api/auth → :8787` 代理，零配置改动。

---

## 七、已知债务（本期不做，记录在案）

| 债务 | 说明 |
|---|---|
| 登录限流 | 无 login_attempts 表，可暴力撞库 |
| session 轮换 | 登录/注册不轮换 token |
| session 过期校验 | `expires_at` 从不检查，session 理论永久有效 |
| token 哈希存储 | `refresh_token_hash` 仍存 cookie 原值 |
| 中间件写放大 | 每请求 UPDATE users |
| 注册限流 | 清 cookie 可无限注册 |
| 废弃 guest 行清理 | 登录后旧 guest 行成孤儿 |
| 改密踢其他设备 | 改密后其他 session 不失效 |
| CSRF token | 仅靠 SameSite=Lax + CORS |
| 注销账号 | 下期 |
| 云端同步占卜记录 | 下期 |
| 真实短信/邮箱验证 | 字段已预留，待接通道 |
