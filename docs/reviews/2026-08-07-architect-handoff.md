# 重启 OpenCode 后的第一问(给架构 Agent 的 prompt,可直接复制)

## 使用说明

把下方"评审 prompt"整段贴进新 OpenCode 对话(项目同一目录 `D:\eight`)的第一个 user message。architect agent 已经在 `.opencode/agents/architect.md` 写好,新 session 会自动加载。

如果 agent 没自动出现,说明 OpenCode 没识别——那时再用 `task tool` 显式调度:`{ subagent_type: "architect", ... }`。

---

## 评审 prompt(可直接复制粘贴)

```
你是本项目的架构评判 Agent(千问 3.8 Max)。开始评判前请先读以下两份文档:
- D:\eight\AGENTS.md(运行命令 + 编码规范)
- D:\eight\AGENTS.project.md(架构与部署)

读完两份后,评判下面 6 个讨论结果。每个用你 SKILL.md 里规定的输出格式(问题/判断/漏洞/改进/不要做的事)回复。

## 议题 1:起卦配额硬编码为"guest 1 次免费"
现状:`worker/src/middleware/session.ts:159` 写死 `remaining = Math.max(0, 1 - count)`,guest 永远只能 1 次起卦(一辈子)。Discussion 中用户问及"次数限制规则"时,我把这条标为"硬1 次,不可调"。
问题:这个规则合理吗?改成"每 UTC 日 1 次"或"前 3 次免费"会有什么副作用?后端 D1 表 schema 需要变吗?前端 quota.ts 的双层防御(本地 localStorage + Worker 二验)会受影响吗?

## 议题 2:AI 解读配额按 IP 不是按用户
现状:`functions/api/proxy/anthropic/v1/messages.ts` 按 `cf-connecting-ip` 计每日 5 次。意味着共享 WiFi / 公司 NAT 后面所有人是同一个 5 次。
问题:这个对真实用户体验伤害多大?改成"按注册 userId"(已有 session.id 可用)工程复杂度多少?GDPR/隐私上"按 IP 计"和"按 userId 计"哪个更敏感?

## 议题 3:AI_DEMO_KEY 配额"失败也计数"
现状:`messages.ts:226` 即使上游 5xx 也 INSERT ai_usage,注释说"防攻击者刷失败免费"。已有测试 #6b 钉住这个行为。
问题:这条策略对小流量 / 单用户场景会不会误伤?(如用户手机断网重试算不算一次?)改成"只有 ok 才计"或"加 5 分钟 cooldown"哪个更稳?反爬意图能否用更轻的方式达到?

## 议题 4:DB binding 缺失时 fail-open
现状:`messages.ts:161-163`:`if (!context.env.DB) { console.warn('[proxy] DB binding missing — quota not enforced'); ... }` —— 没 DB 直接跳过配额检查继续转发。意味着 Pages dashboard 没配 DB 时,生产 AI 解读全开放,无任何限流。
问题:这条 fail-open 路径是"开发便利"还是"安全漏洞"?生产部署 checklist 里必须包含"DB binding 必须配",但代码本身不做防御——是合理设计还是该改成 fail-closed(返 503)?

## 议题 5:SMS 配额只防滥用,不替代上游限流
现状:worker/src/routes/auth.ts:21 `MAX_ATTEMPTS_PER_HOUR = 5` 是我们自己 D1 表的限频;但 Function 收到 Anthropic 真 429 时直接透传 `rate-limit` 错误码给前端。
问题:在我们 demo key 共享 + 用户增长的前提下,Anthropic 自己 rate limit 的边界在哪?我们 5/天/IP 是否可能在某个时点被 Anthropic 自己的全局限流挡住?如果被挡住,用户体验是什么?

## 议题 6:cookie 寿命 1 年
现状:`worker/src/middleware/session.ts:27` `COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60`。清浏览器 cookie 就回到 guest,获得新 1 次免费起卦。
问题:这条对 1 次免费策略的实际影响有多大?(用户清 cookie 重置配额)要不要加 IP + cookie 双因子?GDPR / 用户删除账号的策略存在吗?

请就这 6 个议题给出独立评判,每个议题独立评分(0-10:规则健康度)。
```

---

## 为什么是这 6 个议题

来自本次会话的讨论脉络——用户在"次数限制规则"里追问了具体细节,我把整套规则摸出来后,以下 6 个是**有真实设计张力 / 可能引发产品/工程争议**的点:

| #   | 议题                              | 张力来源                  |
| --- | --------------------------------- | ------------------------- |
| 1   | guest 硬 1 次                     | 永久 vs 每日,产品视角分歧 |
| 2   | AI 按 IP 不按用户                 | 工程便利 vs 用户体验      |
| 3   | 失败也计数                        | 防爬 vs 误伤              |
| 4   | DB 缺则 fail-open                 | 开发便利 vs 线上安全      |
| 5   | SMS 限频 + Anthropic 限流         | 双重限流的边界            |
| 6   | cookie 寿命 1 年 + 清 cookie 重置 | 用户行为绕过配额          |

如果 architect agent 评判完后还有未覆盖的疑问,你再追加 prompt。

---

## 本次会话背景(供 architect 参考)

会话名:部署 Phase 1 + 文案统一 + 配额调研。
已 commit 现状(本地领先 origin/main):

- ce7c17b docs: split AGENTS.md
- 4f9c7e8 ui: rename AI 解读 → 卦象详解
- 7fe5408 feat(ai): backend-proxied AI demo + tests + X-AI-Mode fix
- 32794ff fix(worker): add Bindings typing + sitemap + reformat

已部署:production at orix-studio.pages.dev,Pages AI_DEMO_KEY 已配,DB binding 已配,D1 schema 已 migrate,Function 端到端真实链路 200 + 真 MiniMax 响应(已联调验证)。

未 commit 改动(无功能改动,只是文档/配置):

- .opencode/agents/architect.md(本次新建,模型 = qwen3.8-max)
- 其它 22+ 个 untracked 杂物(包括含明文 Cloudflare token 的 tmp-check-cf.ps1,建议尽快 revoke + 删除)
