# 账号系统（用户名+密码）实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为易象阁添加用户名+密码的注册/登录/登出/改密/改昵称，保留 guest 模式，删除 mock SMS 代码。

**Architecture:** 增量演进——现有 Worker（Hono+Drizzle+D1）guest session 架构上叠加账号层。migration 0003 重建 users 表（加 status/username/phone/email 列），auth 路由重写为 username/password 流程，前端顶栏+弹窗+设置页账号区块。

**Tech Stack:** Hono / Drizzle / D1 / Web Crypto PBKDF2（零依赖）/ React / Vitest / vitest-pool-workers

**设计文档:** `docs/plans/2026-08-20-account-system-design.md`

---

## 关键约定（必读）

- Worker 新代码 import **必须带 `.js` 后缀**（`from '../lib/password.js'`）——AGENTS.md 硬性规定
- 前端：单引号、无分号；路径别名 `@/*` → `src/*`
- Worker 测试模式：`app.request(path, init, env)` + `applyD1Migrations()` + `runD1Query()`（见 `tests/worker/auth.test.ts` 现有写法）
- 错误响应统一 `{ code, message }`
- **验证口径**：Task 结束走 `npm run typecheck`（必须 0 错）+ `npm run build`（必须通过）。`docs/archive/2026-08-15/repo-restructure.md` 里 `tests/samples/cardPreviewV2.test.ts` TS2554 的旧规避说明作废——main HEAD 不带那个文件，约束不再是 pre-existing。
- 每个 Task 结束 commit 一次（conventional commits 风格）

---

# PR-A：Worker 侧

## Task 1: migration 0003 + 迁移测试（TDD）

**Files:**
- Create: `worker/src/db/migrations/0003_account_system.sql`
- Modify: `tests/worker/migration.test.ts`

**Step 1: 写失败测试**

在 `tests/worker/migration.test.ts` 末尾追加：

```ts
describe('migration 0003: account system', () => {
  it('rebuilds users with status/username/phone/email and drops sms columns', async () => {
    await applyD1Migrations()

    const userCols = await runD1Query<{ name: string; type: string; notnull: number }>(
      'PRAGMA table_info(users)'
    )
    const byName = Object.fromEntries(userCols.map((c) => [c.name, c]))

    expect(byName['status']?.type).toBe('TEXT')
    expect(byName['status']?.notnull).toBe(1)
    expect(byName['username']?.type).toBe('TEXT')
    expect(byName['username']?.notnull).toBe(0)
    expect(byName['phone']?.type).toBe('TEXT')
    expect(byName['email']?.type).toBe('TEXT')
    expect(byName['email']?.notnull).toBe(0)
    expect(byName['password_hash']).toBeDefined()

    const userIndexes = await runD1Query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='users'"
    )
    const userIndexNames = userIndexes.map((i) => i.name)
    expect(userIndexNames).toContain('users_username_idx')
    expect(userIndexNames).toContain('users_phone_idx')
    expect(userIndexNames).toContain('users_email_idx')

    const sessionCols = await runD1Query<{ name: string }>('PRAGMA table_info(sessions)')
    const sessionNames = sessionCols.map((c) => c.name)
    expect(sessionNames).not.toContain('sms_phone')
    expect(sessionNames).not.toContain('sms_code')
    expect(sessionNames).not.toContain('sms_expires_at')
    expect(sessionNames).not.toContain('sms_verify_attempts')
    expect(sessionNames).not.toContain('sms_locked_until')

    const sessionIndexes = await runD1Query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='sessions'"
    )
    expect(sessionIndexes.map((i) => i.name)).not.toContain('sessions_sms_phone_idx')
  })

  it('username unique index is case-insensitive (NOCASE)', async () => {
    await applyD1Migrations()
    const now = Date.now()
    await runD1Query(
      `INSERT INTO users (id, status, username, password_hash, last_seen_at, created_at, updated_at)
       VALUES ('u1', 'registered', 'Alice', 'x', ${now}, ${now}, ${now})`
    )
    await expect(
      runD1Query(
        `INSERT INTO users (id, status, username, password_hash, last_seen_at, created_at, updated_at)
         VALUES ('u2', 'registered', 'alice', 'x', ${now}, ${now}, ${now})`
      )
    ).rejects.toThrow(/UNIQUE/i)
  })
})
```

**Step 2: 运行确认失败**

Run: `npx vitest run tests/worker/migration.test.ts`（在仓库根目录）
Expected: FAIL（0003 不存在，断言失败）

**Step 3: 写迁移 SQL**

Create `worker/src/db/migrations/0003_account_system.sql`:

```sql
-- 账号系统: 重建 users 表(status/username/phone/email), 清理 sessions 的 sms_* 列。
-- 设计文档: docs/plans/2026-08-20-account-system-design.md
--
-- 注意: 必须在 foreign_keys=OFF 下执行 DROP TABLE users,
-- 否则 SQLite 会对父表做隐式 DELETE 并级联删除 sessions/posts 等子表数据。
PRAGMA foreign_keys = OFF;

CREATE TABLE users_new (
  id              TEXT PRIMARY KEY,
  status          TEXT NOT NULL DEFAULT 'guest' CHECK (status IN ('guest', 'registered')),
  username        TEXT,
  password_hash   TEXT NOT NULL DEFAULT '!',
  phone           TEXT,
  email           TEXT,
  nickname        TEXT,
  region          TEXT,
  timezone        TEXT,
  last_seen_at    INTEGER,
  visit_count     INTEGER NOT NULL DEFAULT 1,
  user_agent      TEXT NOT NULL DEFAULT '',
  accept_language TEXT NOT NULL DEFAULT '',
  first_referer   TEXT,
  last_referer    TEXT,
  ip_address      TEXT NOT NULL DEFAULT '',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

INSERT INTO users_new (
  id, status, password_hash, nickname, region, timezone,
  last_seen_at, visit_count, user_agent, accept_language,
  first_referer, last_referer, ip_address, created_at, updated_at
)
SELECT
  id, 'guest', password_hash, nickname, region, timezone,
  last_seen_at, visit_count, user_agent, accept_language,
  first_referer, last_referer, ip_address, created_at, updated_at
FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE UNIQUE INDEX users_username_idx ON users(username COLLATE NOCASE);
CREATE UNIQUE INDEX users_phone_idx ON users(phone);
CREATE UNIQUE INDEX users_email_idx ON users(email);
CREATE INDEX users_last_seen_idx ON users(last_seen_at);

-- sessions: 先删索引(DROP COLUMN 不允许列在索引中), 再删列
DROP INDEX sessions_sms_phone_idx;

ALTER TABLE sessions DROP COLUMN sms_phone;
ALTER TABLE sessions DROP COLUMN sms_code;
ALTER TABLE sessions DROP COLUMN sms_expires_at;
ALTER TABLE sessions DROP COLUMN sms_verify_attempts;
ALTER TABLE sessions DROP COLUMN sms_locked_until;

PRAGMA foreign_keys = ON;
PRAGMA foreign_key_check;
```

**Step 4: 运行确认通过**

Run: `npx vitest run tests/worker/migration.test.ts`
Expected: PASS（全部迁移测试）

**Step 5: Commit**

```bash
git add worker/src/db/migrations/0003_account_system.sql tests/worker/migration.test.ts
git commit -m "feat(worker): migration 0003 — account system schema (users rebuild, drop sms columns)"
```

---

## Task 2: 更新 Drizzle schema

**Files:**
- Modify: `worker/src/db/schema.ts`

**Step 1: 改 users 表定义**

替换 `schema.ts` 中 `users` 表定义（第 23-48 行）为：

```ts
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  status: text('status').notNull().default('guest'),
  username: text('username'),
  passwordHash: text('password_hash').notNull().default('!'),
  phone: text('phone'),
  email: text('email'),
  nickname: text('nickname'),

  region: text('region'),
  timezone: text('timezone'),

  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  visitCount: integer('visit_count').notNull().default(1),
  userAgent: text('user_agent').notNull().default(''),
  acceptLanguage: text('accept_language').notNull().default(''),
  firstReferer: text('first_referer'),
  lastReferer: text('last_referer'),
  ipAddress: text('ip_address').notNull().default(''),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  usernameIdx: index('users_username_idx').on(table.username),
  phoneIdx: index('users_phone_idx').on(table.phone),
  emailIdx: index('users_email_idx').on(table.email),
  lastSeenIdx: index('users_last_seen_idx').on(table.lastSeenAt),
}))
```

注意：真实索引带 `COLLATE NOCASE`（见迁移 SQL），Drizzle 的 `index()` 不支持 COLLATE，这里仅作元数据；登录查询需显式 COLLATE（Task 5）。

**Step 2: 删 sessions 的 sms 字段**

`sessions` 表定义中删除 `smsPhone`/`smsCode`/`smsExpiresAt`/`smsVerifyAttempts`/`smsLockedUntil` 五列及 `smsPhoneIdx` 索引。

**Step 3: 验证**

Run: `npm run build`（在 `worker/` 目录）
Expected: 0 errors（此时 auth.ts/session.ts 还在引用被删字段 → **预期会报错**。若报错全部来自 `routes/auth.ts` 和 `middleware/session.ts` 的 sms/email 字段引用，属正常，Task 4/5 会修。若其他文件报错则需立即处理。）

**Step 4: Commit**

```bash
git add worker/src/db/schema.ts
git commit -m "feat(worker): schema.ts — users status/username/phone/email, drop sessions sms fields"
```

---

## Task 3: PBKDF2 密码工具（TDD）

**Files:**
- Create: `worker/src/lib/password.ts`
- Create: `tests/worker/password.test.ts`

**Step 1: 写失败测试**

Create `tests/worker/password.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../../worker/src/lib/password'

describe('password hashing (PBKDF2)', () => {
  it('produces self-describing pbkdf2$ format', async () => {
    const hash = await hashPassword('test-password-123')
    const parts = hash.split('$')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe('pbkdf2')
    expect(Number(parts[1])).toBeGreaterThan(0)
  })

  it('different salts for same password', async () => {
    const a = await hashPassword('same-password')
    const b = await hashPassword('same-password')
    expect(a).not.toBe(b)
  })

  it('verifies correct password', async () => {
    const hash = await hashPassword('correct-horse-battery')
    expect(await verifyPassword('correct-horse-battery', hash)).toBe(true)
  })

  it('rejects wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery')
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('rejects malformed stored hash', async () => {
    expect(await verifyPassword('anything', '!')).toBe(false)
    expect(await verifyPassword('anything', 'sms')).toBe(false)
    expect(await verifyPassword('anything', '')).toBe(false)
  })

  it('handles unicode passwords', async () => {
    const hash = await hashPassword('密码-周易-64卦')
    expect(await verifyPassword('密码-周易-64卦', hash)).toBe(true)
    expect(await verifyPassword('密码-周易-65卦', hash)).toBe(false)
  })
})
```

**Step 2: 运行确认失败**

Run: `npx vitest run tests/worker/password.test.ts`
Expected: FAIL（模块不存在）

**Step 3: 实现**

Create `worker/src/lib/password.ts`:

```ts
const ITERATIONS = 210000

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    256,
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  const hash = await derive(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isFinite(iterations) || iterations <= 0) return false

  let expected: Uint8Array
  try {
    expected = fromBase64(parts[3])
  } catch {
    return false
  }
  const actual = await derive(password, fromBase64(parts[2]), iterations)

  let diff = actual.length === expected.length ? 0 : 1
  for (let i = 0; i < Math.min(actual.length, expected.length); i++) {
    diff |= actual[i] ^ expected[i]
  }
  return diff === 0
}
```

**Step 4: 运行确认通过**

Run: `npx vitest run tests/worker/password.test.ts`
Expected: PASS（6 个用例）。若单测耗时 >5s，记录 PBKDF2 耗时（`console.time` 临时加），评估是否需要降迭代次数。

**Step 5: Commit**

```bash
git add worker/src/lib/password.ts tests/worker/password.test.ts
git commit -m "feat(worker): PBKDF2 password hashing via Web Crypto"
```

---

## Task 4: session 中间件改造

**Files:**
- Modify: `worker/src/middleware/session.ts`
- Modify: `tests/worker/session-middleware.test.ts`

**Step 1: 改中间件**

`worker/src/middleware/session.ts` 三处修改：

1. `SessionEnv` 的 Bindings 加 `ENVIRONMENT?: string`（wrangler 自动注入，deploy 时为 `'production'`）：

```ts
export type SessionEnv = {
  Bindings: {
    DB: D1Database;
    ENVIRONMENT?: string;
  };
  Variables: { ... };  // 不变
};
```

2. guest 创建（原第 90-97 行）改为：

```ts
await db.insert(users).values({
  id: newId,
  status: 'guest',
  passwordHash: '!',
  lastSeenAt: now,
  createdAt: now,
  updatedAt: now,
});
```

3. mode 推导（原第 146-155 行）改为：

```ts
const userRow = await db
  .select({ status: users.status })
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);

const mode: "guest" | "registered" =
  userRow[0]?.status === "registered" ? "registered" : "guest";
```

4. cookie 加条件 Secure（原第 135-140 行 setCookie）：

```ts
setCookie(c, COOKIE_NAME, sessionId, {
  httpOnly: true,
  secure: c.env.ENVIRONMENT === "production",
  sameSite: "Lax",
  maxAge: COOKIE_MAX_AGE_S,
  path: "/",
});
```

5. 导出供 auth 路由 logout 复用的常量与函数：`export const COOKIE_NAME`、`export const COOKIE_MAX_AGE_S`、`export function randomId()`（去掉原 `function randomId` 的非导出声明）。

**Step 2: 更新 session-middleware 测试**

`tests/worker/session-middleware.test.ts`：把所有依赖 `guest-...@zhouyi.local` email 判定的断言改为查 `users.status` 列；删除 SMS 相关用例。保留：无 cookie 铸 guest、有 cookie 复用 session、mode 推导（guest/registered 两种 status）。

**Step 3: 运行**

Run: `npx vitest run tests/worker/session-middleware.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add worker/src/middleware/session.ts tests/worker/session-middleware.test.ts
git commit -m "feat(worker): session middleware — status-based mode, Secure cookie in prod"
```

---

## Task 5: 重写 auth 路由（TDD）

**Files:**
- Modify: `worker/src/routes/auth.ts`（整体重写）
- Modify: `tests/worker/auth.test.ts`（整体重写）

**Step 1: 写失败测试**

整体重写 `tests/worker/auth.test.ts`。测试骨架（沿用现有 setupApp 模式）：

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { authRouter } from "../../worker/src/routes/auth";
import { sessionMiddleware } from "../../worker/src/middleware/session";
import { applyD1Migrations, runD1Query } from "./helpers/d1";
import { Hono } from "hono";

async function setupApp(): Promise<Hono> {
  await applyD1Migrations();
  const app = new Hono<{
    Bindings: { DB: D1Database };
    Variables: { userId: string; sessionId: string; mode: "guest" | "registered" };
  }>();
  app.use("*", sessionMiddleware);
  app.route("/api/auth", authRouter);
  return app;
}

function cookieFrom(res: Response): string {
  return res.headers.get("set-cookie")!.split(";")[0];
}

async function registerGuest(app: Hono, username: string, password: string) {
  const first = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  }, env);
  return first;
}

beforeEach(async () => {
  await applyD1Migrations();
  await runD1Query("DELETE FROM sessions");
  await runD1Query("DELETE FROM users");
});
```

用例清单（每个一个 `it`）：

**POST /register**
1. guest 注册成功 → 201，`{ userId, username, mode: 'registered' }`；DB 中该用户 `status='registered'`、`password_hash` 以 `pbkdf2$` 开头
2. 用户名非法（`"a"` 太短 / `"bad name!"` 含空格标点 / 17 字符超长）→ 400 `invalid_username`
3. 密码 <8 位 → 400 `weak_password`
4. 用户名大小写冲突：先注册 `Alice`，新 session 注册 `alice` → 409 `username_taken`
5. 中文用户名注册成功（`"周易大师"`）→ 201
6. 已 registered 的 session 再注册 → 400 `already_registered`（复用第一次注册返回的 cookie——注意注册不换 cookie，session 仍是同一个）

**POST /login**
7. 正确凭据 → 200 `{ userId, username, nickname, mode: 'registered' }`；且新 cookie 的 session 在 DB 中指向该用户（用登录前后两个 cookie 分别请求需要 session 的端点验证，或直接查 DB）
8. 用户名大小写不同也能登录（注册 `Alice`，登录 `alice`）→ 200
9. 密码错误 → 401 `invalid_credentials`
10. 用户名不存在 → 401 `invalid_credentials`（message 与用例 9 完全一致）
11. guest 期间的数据保留：注册前用 guest session 发一条 feed 帖子（或直接 INSERT shared_posts），注册后帖子仍在且 user_id 不变

**POST /logout**
12. registered 登出 → 200 `{ mode: 'guest' }`；返回新 Set-Cookie；旧 session 行已删除；新 cookie 对应新 guest 用户

**PATCH /password**
13. guest 调用 → 403 `guest_forbidden`
14. 旧密码错误 → 401 `wrong_password`
15. 成功改密 → 200；旧密码登录失败、新密码登录成功

**PATCH /nickname**
16. guest 调用 → 403 `guest_forbidden`
17. 成功 → 200 `{ nickname }`；DB 更新
18. 超 16 字符 → 400 `invalid_nickname`

**Step 2: 运行确认失败**

Run: `npx vitest run tests/worker/auth.test.ts`
Expected: FAIL（路由不存在）

**Step 3: 重写 auth.ts**

整体替换 `worker/src/routes/auth.ts`：

```ts
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { z } from "zod";
import { getDb } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { eq, sql } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  COOKIE_NAME,
  COOKIE_MAX_AGE_S,
  randomId,
} from "../middleware/session.js";

const USERNAME_REGEX = /^[\u4e00-\u9fa5a-zA-Z0-9_]+$/;

function validUsername(u: string): boolean {
  const chars = Array.from(u);
  return chars.length >= 2 && chars.length <= 16 && USERNAME_REGEX.test(u);
}

function validNickname(s: string): boolean {
  const n = Array.from(s.trim()).length;
  return n >= 1 && n <= 16;
}

export const authRouter = new Hono<{
  Bindings: { DB: D1Database; ENVIRONMENT?: string };
  Variables: {
    userId: string;
    sessionId: string;
    mode: "guest" | "registered";
  };
}>();

const registerSchema = z.object({
  username: z.string().refine(validUsername, { message: "invalid_username" }),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const passwordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const nicknameSchema = z.object({
  nickname: z.string().refine(validNickname, { message: "invalid_nickname" }),
});

authRouter.post("/register", async (c) => {
  if (c.var.mode === "registered") {
    return c.json({ code: "already_registered", message: "当前会话已注册" }, 400);
  }
  const raw = await c.req.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "username") {
      return c.json({ code: "invalid_username", message: "用户名需 2-16 位中英文/数字/下划线" }, 400);
    }
    return c.json({ code: "weak_password", message: "密码需 8-128 位" }, 400);
  }
  const { username, password } = parsed.data;
  const db = getDb(c.env.DB);
  const passwordHash = await hashPassword(password);
  try {
    await db
      .update(users)
      .set({
        status: "registered",
        username,
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, c.var.userId));
  } catch (err) {
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      return c.json({ code: "username_taken", message: "用户名已被占用" }, 409);
    }
    throw err;
  }
  return c.json({ userId: c.var.userId, username, mode: "registered" }, 201);
});

authRouter.post("/login", async (c) => {
  const raw = await c.req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(raw);
  const fail = () =>
    c.json({ code: "invalid_credentials", message: "用户名或密码错误" }, 401);
  if (!parsed.success) return fail();
  const { username, password } = parsed.data;

  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(users)
    .where(sql`${users.username} = ${username} COLLATE NOCASE`)
    .limit(1);
  const user = rows[0];
  if (!user || user.status !== "registered") return fail();

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return fail();

  await db
    .update(sessions)
    .set({ userId: user.id })
    .where(eq(sessions.refreshTokenHash, c.var.sessionId));

  return c.json({
    userId: user.id,
    username: user.username,
    nickname: user.nickname,
    mode: "registered",
  });
});

authRouter.post("/logout", async (c) => {
  const db = getDb(c.env.DB);
  await db
    .delete(sessions)
    .where(eq(sessions.refreshTokenHash, c.var.sessionId));

  const newSessionId = randomId();
  const newUserId = randomId();
  const now = new Date();
  await db.insert(users).values({
    id: newUserId,
    status: "guest",
    passwordHash: "!",
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(sessions).values({
    id: randomId(),
    userId: newUserId,
    refreshTokenHash: newSessionId,
    expiresAt: new Date(Date.now() + COOKIE_MAX_AGE_S * 1000),
    createdAt: now,
  });

  setCookie(c, COOKIE_NAME, newSessionId, {
    httpOnly: true,
    secure: c.env.ENVIRONMENT === "production",
    sameSite: "Lax",
    maxAge: COOKIE_MAX_AGE_S,
    path: "/",
  });

  return c.json({ mode: "guest" });
});

authRouter.patch("/password", async (c) => {
  if (c.var.mode !== "registered") {
    return c.json({ code: "guest_forbidden", message: "请先注册" }, 403);
  }
  const raw = await c.req.json().catch(() => ({}));
  const parsed = passwordSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ code: "weak_password", message: "新密码需 8-128 位" }, 400);
  }
  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, c.var.userId))
    .limit(1);
  const user = rows[0];
  if (!user || !(await verifyPassword(parsed.data.oldPassword, user.passwordHash))) {
    return c.json({ code: "wrong_password", message: "旧密码错误" }, 401);
  }
  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(parsed.data.newPassword),
      updatedAt: new Date(),
    })
    .where(eq(users.id, c.var.userId));
  return c.json({ ok: true });
});

authRouter.patch("/nickname", async (c) => {
  if (c.var.mode !== "registered") {
    return c.json({ code: "guest_forbidden", message: "请先注册" }, 403);
  }
  const raw = await c.req.json().catch(() => ({}));
  const parsed = nicknameSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ code: "invalid_nickname", message: "昵称需 1-16 字符" }, 400);
  }
  const nickname = parsed.data.nickname.trim();
  const db = getDb(c.env.DB);
  await db
    .update(users)
    .set({ nickname, updatedAt: new Date() })
    .where(eq(users.id, c.var.userId));
  return c.json({ nickname });
});
```

**Step 4: 运行确认通过**

Run: `npx vitest run tests/worker/auth.test.ts`
Expected: PASS（18 个用例）

**Step 5: Commit**

```bash
git add worker/src/routes/auth.ts tests/worker/auth.test.ts
git commit -m "feat(worker): username/password auth routes (register/login/logout/password/nickname)"
```

---

## Task 6: me 路由扩展

**Files:**
- Modify: `worker/src/routes/me.ts`
- Modify: `tests/worker/me.test.ts`

**Step 1: 更新测试**

`tests/worker/me.test.ts` 追加用例：registered 用户（先注册）请求 `/me` 返回 `{ userId, mode: 'registered', username, nickname }`；guest 返回 `{ userId, mode: 'guest' }` 且**不含** username/nickname 键。

**Step 2: 改 me.ts**

```ts
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { users } from "../db/schema.js";
import type { SessionEnv } from "../middleware/session";

export const meRouter = new Hono<SessionEnv>();

meRouter.get("/me", async (c) => {
  const base = { userId: c.var.userId, mode: c.var.mode };
  if (c.var.mode !== "registered") return c.json(base);

  const db = getDb(c.env.DB);
  const rows = await db
    .select({ username: users.username, nickname: users.nickname })
    .from(users)
    .where(eq(users.id, c.var.userId))
    .limit(1);
  return c.json({
    ...base,
    username: rows[0]?.username ?? null,
    nickname: rows[0]?.nickname ?? null,
  });
});
```

**Step 3: 运行**

Run: `npx vitest run tests/worker/me.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add worker/src/routes/me.ts tests/worker/me.test.ts
git commit -m "feat(worker): /me returns username/nickname for registered users"
```

---

## Task 7: Worker 全量验证 + 本地数据保留演练

**Step 1: 全量测试 + 构建**

Run（`worker/` 目录）: `npm run build && npm test`（根目录跑 `npx vitest run tests/worker/` 亦可）
Expected: 0 build errors，全部测试通过（5 个文件）

**Step 2: 本地 D1 数据保留演练（关键安全步骤）**

在本地 D1 验证 rebuild 不丢数据：

```bash
cd worker
npx wrangler d1 migrations apply zhouyi-db --local
# 造数据: 2 个 guest + session + 1 条 feed 帖子
npx wrangler d1 execute zhouyi-db --local --command "INSERT INTO users (id, status, password_hash, last_seen_at, created_at, updated_at) VALUES ('g1','guest','!',1,1,1),('g2','guest','!',1,1,1); INSERT INTO sessions (id, user_id, refresh_token_hash, expires_at, created_at) VALUES ('s1','g1','tok1',9999999999999,1),('s2','g2','tok2',9999999999999,1); INSERT INTO shared_posts (id, user_id, main_hexagram_id, changed_hexagram_id, moving_line, created_at) VALUES ('p1','g1',1,2,1,1);"
# 此时 0003 已应用过则跳过; 若本地库是旧的(未应用 0003), 先造数据再 apply
npx wrangler d1 execute zhouyi-db --local --command "SELECT COUNT(*) AS users FROM users; SELECT COUNT(*) AS sessions FROM sessions; SELECT COUNT(*) AS posts FROM shared_posts; SELECT status, COUNT(*) FROM users GROUP BY status;"
```

Expected: users=2（全 guest）、sessions=2、posts=1，**无级联丢失**。若本地库已是新 schema（Step 1 已 apply），则先 `npx wrangler d1 execute zhouyi-db --local --command "DROP TABLE ..."` 重建旧库重演——或直接用 `--local` 新库验证 INSERT...SELECT 路径已被测试覆盖即可，此步核心是确认 foreign_keys 处理正确。

**Step 3: Commit（如有修复）**

---

# PR-B：前端侧

## Task 8: 重写 src/lib/auth.ts（TDD）

**Files:**
- Modify: `src/lib/auth.ts`（整体重写）
- Create: `tests/lib/auth.test.ts`

**Step 1: 写失败测试**

Create `tests/lib/auth.test.ts`（vi.stubGlobal mock fetch；vitest 下 `import.meta.env.DEV` 为 true，base URL 为 `''`）：

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  refreshAuth,
  register,
  login,
  logout,
  changePassword,
  changeNickname,
  getAuthState,
  subscribeAuth,
  resetAuthCache,
} from '@/lib/auth'

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  resetAuthCache()
  vi.unstubAllGlobals()
})

describe('refreshAuth', () => {
  it('guest response → guest state', async () => {
    mockFetchOnce({ userId: 'u1', mode: 'guest' })
    const state = await refreshAuth()
    expect(state).toEqual({ status: 'guest', userId: 'u1' })
  })

  it('registered response carries username/nickname', async () => {
    mockFetchOnce({ userId: 'u1', mode: 'registered', username: 'alice', nickname: '小爱' })
    const state = await refreshAuth()
    expect(state).toEqual({ status: 'registered', userId: 'u1', username: 'alice', nickname: '小爱' })
  })

  it('network failure falls back to guest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')))
    const state = await refreshAuth()
    expect(state.status).toBe('guest')
  })

  it('sends credentials include', async () => {
    const fetchMock = mockFetchOnce({ userId: 'u1', mode: 'guest' })
    await refreshAuth()
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
  })
})

describe('register/login', () => {
  it('register ok', async () => {
    mockFetchOnce({ userId: 'u1', username: 'alice', mode: 'registered' })
    expect(await register('alice', 'password123')).toEqual({ ok: true })
  })

  it('register 409 surfaces server message', async () => {
    mockFetchOnce({ code: 'username_taken', message: '用户名已被占用' }, false, 409)
    const result = await register('alice', 'password123')
    expect(result).toEqual({ ok: false, code: 'username_taken', message: '用户名已被占用' })
  })

  it('login 401 invalid_credentials', async () => {
    mockFetchOnce({ code: 'invalid_credentials', message: '用户名或密码错误' }, false, 401)
    const result = await login('alice', 'wrong')
    expect(result.ok).toBe(false)
  })
})

describe('subscribe', () => {
  it('notifies listeners on state change', async () => {
    const listener = vi.fn()
    const unsub = subscribeAuth(listener)
    mockFetchOnce({ userId: 'u1', mode: 'guest' })
    await refreshAuth()
    expect(listener).toHaveBeenCalled()
    unsub()
  })
})
```

**Step 2: 运行确认失败**

Run: `npx vitest run tests/lib/auth.test.ts`
Expected: FAIL（导出缺失）

**Step 3: 重写 src/lib/auth.ts**

```ts
const PROD_BASE = 'https://zhouyi-worker.bringd.workers.dev'

function getBaseUrl(): string {
  const override = (import.meta.env?.VITE_FEED_API_BASE ?? '') as string
  if (override) return override
  if (import.meta.env?.DEV) return ''
  return PROD_BASE
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'guest'; userId: string }
  | { status: 'registered'; userId: string; username: string; nickname: string | null }

export type AuthResult =
  | { ok: true }
  | { ok: false; code: string; message: string }

let cache: AuthState = { status: 'loading' }
const listeners = new Set<() => void>()

function setState(next: AuthState): void {
  cache = next
  for (const listener of listeners) listener()
}

export function getAuthState(): AuthState {
  return cache
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetAuthCache(): void {
  cache = { status: 'loading' }
}

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(getBaseUrl() + path, {
    ...init,
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
  })
}

async function parseError(res: Response, fallback: string): Promise<AuthResult> {
  const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string }
  return { ok: false, code: body.code ?? 'unknown', message: body.message ?? fallback }
}

export async function refreshAuth(): Promise<AuthState> {
  try {
    const res = await authFetch('/api/auth/me')
    if (!res.ok) {
      setState({ status: 'guest', userId: '' })
      return cache
    }
    const body = (await res.json()) as {
      userId: string
      mode: 'guest' | 'registered'
      username?: string | null
      nickname?: string | null
    }
    setState(
      body.mode === 'registered'
        ? {
            status: 'registered',
            userId: body.userId,
            username: body.username ?? '',
            nickname: body.nickname ?? null,
          }
        : { status: 'guest', userId: body.userId }
    )
  } catch {
    setState({ status: 'guest', userId: '' })
  }
  return cache
}

export async function register(username: string, password: string): Promise<AuthResult> {
  const res = await authFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) return parseError(res, '注册失败,请稍后再试')
  return { ok: true }
}

export async function login(username: string, password: string): Promise<AuthResult> {
  const res = await authFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) return parseError(res, '登录失败')
  return { ok: true }
}

export async function logout(): Promise<void> {
  await authFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
  await refreshAuth()
}

export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<AuthResult> {
  const res = await authFetch('/api/auth/password', {
    method: 'PATCH',
    body: JSON.stringify({ oldPassword, newPassword }),
  })
  if (!res.ok) return parseError(res, '修改密码失败')
  return { ok: true }
}

export async function changeNickname(nickname: string): Promise<AuthResult> {
  const res = await authFetch('/api/auth/nickname', {
    method: 'PATCH',
    body: JSON.stringify({ nickname }),
  })
  if (!res.ok) return parseError(res, '修改昵称失败')
  await refreshAuth()
  return { ok: true }
}
```

**Step 4: 运行确认通过**

Run: `npx vitest run tests/lib/auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/auth.ts tests/lib/auth.test.ts
git commit -m "feat: rewrite auth client — username/password API + reactive state"
```

---

## Task 9: useAuth hook

**Files:**
- Create: `src/hooks/useAuth.ts`

**Step 1: 实现**

```ts
import { useSyncExternalStore } from 'react'
import { getAuthState, subscribeAuth } from '@/lib/auth'
import type { AuthState } from '@/lib/auth'

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribeAuth, getAuthState)
}
```

**Step 2: 验证**

Run: `npx vitest run tests/lib/auth.test.ts`（回归）
Expected: PASS

**Step 3: Commit**

```bash
git add src/hooks/useAuth.ts
git commit -m "feat: useAuth hook (useSyncExternalStore)"
```

---

## Task 10: AuthModal 组件

**Files:**
- Create: `src/components/auth/AuthModal.tsx`
- Create: `tests/components/AuthModal.test.tsx`

**Step 1: 写失败测试**

参考 `tests/components/` 现有组件测试风格（render + fireEvent/userEvent）。`vi.mock('@/lib/auth')` mock `login`/`register`/`refreshAuth`。用例：
1. 默认渲染登录 tab（用户名+密码两个输入框，无确认密码框）
2. 切到注册 tab 出现确认密码框
3. 注册时两次密码不一致 → 显示「两次输入的密码不一致」，不调 register
4. login 返回 `{ ok: false, message }` → 显示服务端 message
5. login 成功 → 调 refreshAuth + onClose

**Step 2: 运行确认失败**

Run: `npx vitest run tests/components/AuthModal.test.tsx`
Expected: FAIL

**Step 3: 实现**

样式沿用 `SmsModal.tsx` 的 modal 结构（`fixed inset-0 bg-ink/50` 遮罩 + `bg-rice border-2 border-june-bronze p-6 rounded-md max-w-sm` 卡片 + framer-motion）：

```tsx
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { login, register, refreshAuth } from '@/lib/auth'
import { cn } from '@/utils/cn'

interface AuthModalProps {
  onClose: () => void
}

export function AuthModal({ onClose }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function switchTab(next: 'login' | 'register') {
    setTab(next)
    setError(null)
  }

  async function handleSubmit() {
    setError(null)
    if (tab === 'register' && password !== confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setLoading(true)
    try {
      const result =
        tab === 'login'
          ? await login(username, password)
          : await register(username, password)
      if (!result.ok) {
        setError(result.message)
        return
      }
      await refreshAuth()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-june-bronze rounded-sm bg-rice-warm'

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-rice border-2 border-june-bronze p-6 rounded-md max-w-sm w-full mx-4"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-2 mb-4">
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={cn(
                  'px-4 py-1.5 font-display text-sm rounded-sm transition-colors',
                  tab === t
                    ? 'bg-june-red text-rice'
                    : 'text-ink-light hover:bg-rice-dark'
                )}
              >
                {t === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-ink-light mb-1" htmlFor="auth-username">
                用户名
              </label>
              <input
                id="auth-username"
                type="text"
                maxLength={16}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
                placeholder="2-16 位中英文/数字/下划线"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-light mb-1" htmlFor="auth-password">
                密码
              </label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="至少 8 位"
              />
            </div>
            {tab === 'register' && (
              <div>
                <label className="block text-sm text-ink-light mb-1" htmlFor="auth-confirm">
                  确认密码
                </label>
                <input
                  id="auth-confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputClass}
                  placeholder="再次输入密码"
                />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-june-red mt-2">{error}</p>}

          <div className="flex gap-2 mt-4">
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button variant="primary" onClick={handleSubmit} loading={loading}>
              {tab === 'login' ? '登录' : '注册'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
```

**Step 4: 运行确认通过**

Run: `npx vitest run tests/components/AuthModal.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/auth/AuthModal.tsx tests/components/AuthModal.test.tsx
git commit -m "feat: AuthModal — login/register modal"
```

---

## Task 11: Header 顶栏入口

**Files:**
- Modify: `src/components/layout/Header.tsx`

**Step 1: 加 auth 入口**

Header.tsx 修改：

1. 新增 imports：

```tsx
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { refreshAuth, logout } from '@/lib/auth'
import { AuthModal } from '@/components/auth/AuthModal'
```

2. 组件内新增状态与副作用：

```tsx
const auth = useAuth()
const [authModalOpen, setAuthModalOpen] = useState(false)
const [menuOpen, setMenuOpen] = useState(false)

useEffect(() => {
  void refreshAuth()
}, [])

async function handleLogout() {
  setMenuOpen(false)
  await logout()
}
```

3. 抽取内联 JSX 为组件内函数 `renderAuthEntry()`，在**桌面设置图标 Link 之前**与**移动端设置图标 Link 之前**各插入一次：

```tsx
function renderAuthEntry() {
  if (auth.status === 'registered') {
    const initial = Array.from(auth.username)[0] ?? '?'
    return (
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-8 h-8 rounded-full bg-june-red text-rice font-display text-sm flex items-center justify-center hover:opacity-85 transition-opacity"
          aria-label="账号菜单"
        >
          {initial}
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-2 z-50 bg-rice border-2 border-june-bronze rounded-md shadow-lg min-w-[150px] overflow-hidden">
              <div className="px-4 py-2 text-xs text-ink-light border-b border-june-bronze/30 truncate">
                {auth.nickname || auth.username}
              </div>
              <Link
                to="/settings"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm text-ink hover:bg-rice-dark transition-colors"
              >
                设置
              </Link>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-ink hover:bg-rice-dark transition-colors"
              >
                登出
              </button>
            </div>
          </>
        )}
      </div>
    )
  }
  return (
    <button
      onClick={() => setAuthModalOpen(true)}
      className="px-3 py-1.5 font-display text-sm text-ink hover:text-june-red transition-colors"
    >
      登录
    </button>
  )
}
```

4. 组件 return 末尾（`</header>` 前）挂 modal：

```tsx
{authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
```

**Step 2: 手动验证**

启动三进程 dev（`npm run dev` + `cd worker && npm run dev`），浏览器打开 http://localhost:5173：
- 顶栏出现「登录」按钮 → 点击弹窗 → 注册 → 按钮变头像 → 下拉有登出
- 刷新页面状态保持（cookie）

**Step 3: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: header auth entry — login button / avatar dropdown"
```

---

## Task 12: 设置页账号区块

**Files:**
- Modify: `src/pages/Settings.tsx`

**Step 1: 加账号区块**

Settings.tsx 修改：

1. imports 追加：

```tsx
import { useAuth } from '@/hooks/useAuth'
import { changeNickname, changePassword, logout } from '@/lib/auth'
```

2. 组件内新增状态：

```tsx
const auth = useAuth()
const [serverNickDraft, setServerNickDraft] = useState(auth.status === 'registered' ? (auth.nickname ?? '') : '')
const [pwOld, setPwOld] = useState('')
const [pwNew, setPwNew] = useState('')
const [pwConfirm, setPwConfirm] = useState('')
const [accountBusy, setAccountBusy] = useState(false)
```

3. handlers：

```tsx
async function handleServerNickname() {
  setAccountBusy(true)
  try {
    const result = await changeNickname(serverNickDraft)
    showToast(result.ok ? '昵称已保存' : result.message)
  } finally {
    setAccountBusy(false)
  }
}

async function handleChangePassword() {
  if (pwNew !== pwConfirm) {
    showToast('两次输入的新密码不一致')
    return
  }
  setAccountBusy(true)
  try {
    const result = await changePassword(pwOld, pwNew)
    if (result.ok) {
      showToast('密码已修改')
      setPwOld('')
      setPwNew('')
      setPwConfirm('')
    } else {
      showToast(result.message)
    }
  } finally {
    setAccountBusy(false)
  }
}

async function handleLogout() {
  await logout()
  showToast('已登出')
}
```

4. JSX：在 `<div className="max-w-2xl mx-auto space-y-6">` 开标签后**第一个位置**插入（仅 registered 可见）：

```tsx
{auth.status === 'registered' && (
  <section className="p-6 bg-rice border-2 border-june-bronze rounded-md">
    <h2 className="font-display text-lg text-ink tracking-widest mb-4">账 号</h2>
    <div className="space-y-5">
      <div>
        <div className="font-display text-xs text-june-bronze tracking-widest mb-1">用户名</div>
        <div className="font-mono text-sm text-ink">{auth.username}</div>
        <div className="text-[11px] text-ink-light/70 font-body mt-0.5">注册后不可修改</div>
      </div>

      <div>
        <label className="font-display text-xs text-june-bronze tracking-widest block mb-2" htmlFor="server-nickname">
          昵称（社区显示）
        </label>
        <div className="flex gap-2">
          <input
            id="server-nickname"
            type="text"
            maxLength={16}
            value={serverNickDraft}
            onChange={(e) => setServerNickDraft(e.target.value)}
            className="flex-1 px-3 py-2 font-body text-sm bg-white border border-june-bronze/40 rounded-sm focus:outline-none focus:border-june-red"
            placeholder="1-16 字符"
          />
          <Button variant="primary" size="sm" onClick={handleServerNickname} disabled={accountBusy}>
            保存
          </Button>
        </div>
      </div>

      <div>
        <div className="font-display text-xs text-june-bronze tracking-widest mb-2">修改密码</div>
        <div className="space-y-2">
          <input type="password" value={pwOld} onChange={(e) => setPwOld(e.target.value)}
            placeholder="旧密码"
            className="w-full px-3 py-2 font-body text-sm bg-white border border-june-bronze/40 rounded-sm focus:outline-none focus:border-june-red" />
          <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)}
            placeholder="新密码（至少 8 位）"
            className="w-full px-3 py-2 font-body text-sm bg-white border border-june-bronze/40 rounded-sm focus:outline-none focus:border-june-red" />
          <input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)}
            placeholder="确认新密码"
            className="w-full px-3 py-2 font-body text-sm bg-white border border-june-bronze/40 rounded-sm focus:outline-none focus:border-june-red" />
          <Button variant="secondary" size="sm" onClick={handleChangePassword} disabled={accountBusy || !pwOld || !pwNew}>
            修改密码
          </Button>
        </div>
      </div>

      <div className="pt-2 border-t border-june-bronze/30">
        <Button variant="ghost" size="sm" onClick={handleLogout}>登出</Button>
      </div>
    </div>
  </section>
)}
```

5. 现有本地昵称区块（`src/lib/nickname` 驱动的那段 section）包上 `{auth.status !== 'registered' && ( ... )}`——registered 用户用账号区块的服务端昵称，避免两套昵称混淆。

**Step 2: 手动验证**

dev 环境：注册 → 设置页出现账号区块 → 改昵称 → 社区发帖显示新昵称（feed 读 users.nickname）→ 改密码 → 登出 → 重新登录。

**Step 3: Commit**

```bash
git add src/pages/Settings.tsx
git commit -m "feat: settings account section (nickname/password/logout) for registered users"
```

---

## Task 13: 删除 SmsModal + 全量验证

**Files:**
- Delete: `src/components/auth/SmsModal.tsx`

**Step 1: 确认无引用后删除**

Run: `rg "SmsModal" src/ tests/`
Expected: 只有 SmsModal.tsx 自身。若有其他引用，先迁移。

```bash
git rm src/components/auth/SmsModal.tsx
```

**Step 2: 全量验证**

```bash
npm test                    # 全部通过
npx vite build              # 构建成功（绕过 pre-existing tsc 错误）
cd worker && npm run build && npm test
```

Expected: 前端测试全绿、vite build 成功、worker build+test 全绿。

`npm run typecheck` 必须 0 错（含历史累积、未推动到 main 之前的任何错误）。若发现 pre-existing TS 错误，先单独修掉再前进。

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove orphaned SmsModal (replaced by AuthModal)"
```

---

# 部署（Task 14）

**顺序严格**：先 Worker 迁移+部署，后前端 push。

**Step 1: Worker 生产迁移**（低流量时段）

```bash
cd worker
npx wrangler d1 migrations apply zhouyi-db --remote
```

迁移后立即验证：

```bash
npx wrangler d1 execute zhouyi-db --remote --command "SELECT status, COUNT(*) FROM users GROUP BY status; SELECT COUNT(*) FROM sessions; SELECT COUNT(*) FROM shared_posts;"
```

Expected: guest 数与迁移前一致（可先跑 `SELECT COUNT(*) FROM users` 记录基线），sessions/posts 无损。

**Step 2: Worker 部署**

```bash
cd worker && npx wrangler deploy
```

验证：`curl https://zhouyi-worker.bringd.workers.dev/health` → 200。

**Step 3: 前端上线**

push main → Pages 自动构建。验证：
- 生产站点顶栏出现「登录」按钮
- 注册/登录流程走通（浏览器 DevTools 确认请求打到 `zhouyi-worker.bringd.workers.dev` 且 Set-Cookie 成功）

**⚠️ 已知风险点（部署时观察）**：生产环境 session cookie 是跨站场景（pages.dev → workers.dev），SameSite=Lax 的 cookie 在跨站 fetch 中可能不被携带。若发现生产登录后刷新状态丢失：
1. 先确认现有 feed 功能在生产是否正常（同样依赖跨站 cookie）——这是 pre-existing 行为
2. 修复方案：cookie 改 `SameSite=None; Secure`（session.ts + auth.ts logout 两处 setCookie），dev 环境 localhost 现代浏览器兼容

---

## 验收清单

- [ ] `npm test` 全绿（根目录）
- [ ] `npx vite build` 成功
- [ ] `cd worker && npm run build && npm test` 全绿
- [ ] 本地三进程 dev：注册/登录/登出/改密/改昵称全流程走通
- [ ] 生产迁移后 users/sessions/shared_posts 行数无损
- [ ] 生产注册/登录走通
- [ ] `rg "sms" worker/src/ src/` 无残留（除预留 phone/email 列）
