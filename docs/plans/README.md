# docs/plans 索引

本目录是**规划中或进行中**的设计/计划文档。已执行的计划或被放弃的计划归档到 [`docs/archive/`](../archive/)。

**作者权威文件**：仓库根目录的 [`AGENTS.md`](../../AGENTS.md)（Agent 行为规则）和 [`AGENTS.project.md`](../../AGENTS.project.md)（架构/部署真值）。任何 plan 与这两份冲突时以 AGENTS 为准。

---

## 当前活跃计划

| Plan | 状态 | 范围 |
|---|---|---|
| [`2026-08-20-account-system-design.md`](2026-08-20-account-system-design.md) | 设计已确认，待实施 | 用户名+密码账号体系；保留 guest 模式；删除 mock SMS |
| [`2026-08-20-account-system.md`](2026-08-20-account-system.md) | 实施计划 | 上者的 TDD/任务拆分；PR-A Worker、PR-B 前端 |

## 历史/参考性计划（仍可见，未被采纳为活跃方向）

- `2026-06-02-zhouyi-website-mvp.md` — 早期 MVP 计划，已完成
- `2026-06-06-api-error-handler.md` — 早期 API 错误处理计划，已完成
- `2026-06-08-hexagram-optimization.md` — 爻线渲染优化，已完成
- `2026-07-24-user-registration-and-default-api-key-design.md` — 早期 SMS 账号设计，**被 2026-08-20 account-system 取代**（后者改为 username+password）
- `2026-08-10-orix-fun-features-design.md` / `2026-08-10-orix-fun-features-impl.md` — 已完成
- `2026-08-12-orix-interaction-optimization.md` — 已完成
- `2026-08-15-orix-miniprogram-port.md` / `2026-08-15-orix-miniprogram-port-review.md` — 微信小程序移植**计划**，未启动（`apps/miniprogram/` 不存在）

## 归档

移到 [`docs/archive/`](../archive/)，按时间分目录：

- `docs/archive/2026-08-15/` — 仓库整改 PR 草案（提议删 `server/` + 迁移 pnpm workspaces + `apps/` 重构），**被放弃**，未执行。AGENTS.md 当前的"三 package.json + server/ DEPRECATED 在树里"是反向决策。
