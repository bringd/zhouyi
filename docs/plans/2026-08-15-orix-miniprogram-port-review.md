# 架构评审：易象阁微信小程序移植计划

**日期**: 2026-08-15
**评审对象**: `docs/plans/2026-08-15-orix-miniprogram-port.md`
**评审 Agent**: architect（只评判不实现）
**状态**: 评审意见已全部合入主计划

## 总评

**有条件通过** —— 复用策略与里程碑骨架合理，但两处事实性错误（配额前提、流式论据）需修正后再定 D2/D4/D8。

## 关键问题

### 致命

1. **D2 论据错误，且被 D4 锁死**：官方文档显示 wx.request `enableChunked` 自基础库 2.20.2 支持，未注明 iOS 不支持；真正的瓶颈是**云函数响应不能流式**。走云开发 ⇒ 必然非流式。建议 M0 真机实测后再定 D2，勿预先写死。

### 高

2. **配额前提已失效**：`functions/api/proxy/anthropic/v1/messages.ts` Phase 2 已移除 per-IP 配额与 X-AI-Quota 头（"no quota is enforced"）。§5.1"预算/限流逻辑随迁"、R8"复用预算控制"均基于不存在的逻辑。迁云函数后成本敞口真实存在：要么在云函数内重建 openid/IP 日配额，要么显式接受并记录。
3. **M3 账号断链**：SMS 是 mock（`worker/src/routes/auth.ts` 仅 console.log 打码）。openid 与 token 不互斥：云函数 `code2Session` 得 openid → 签发 token → 客户端走 Authorization header，才是最小改动。
4. **视觉移植严重低估**：全站 Tailwind 3，工具类数百个，"手写 30 类映射"不可行。应改 tailwindcss CLI 扫描源码生成 WXSS 的构建方案。
5. **token 分支安全边界**：sessionMiddleware 现对无效凭证静默铸 guest（`worker/src/middleware/session.ts:70-73`）；header 分支必须**无效即 401**，禁止落入 guest 铸发，否则用户串数据。另 `expiresAt` 从未校验（session.ts:76-80），顺手修。

### 中

6. 云函数超时未提：非流式 AI（max_tokens 1024）可达数十秒，须显式调到 ≥60s，与 wx.request 超时对齐。
7. "云开发基础版≈免费"疑过期：2024 年起改订阅制、新环境免费额度取消（需核实）。
8. Intl fallback 过度设计：用户几乎全在 Asia/Shanghai（无 DST），fallback 直接格式化设备本地 YYYY-MM-DD，**勿落 UTC**（Web 版 daily.ts 的 UTC 兜底在北京时间 0-8 点会出错的卦）。
9. "个人主体即可"与 M3 冲突：个人主体无 getPhoneNumber、类目受限。

### 低

10. `relationships.json` 不存在（src/data/ 仅 hexagrams + trigrams），需更正。
11. canvas 应用 `<canvas type="2d">` 新 API，弃用的 wx.createCanvasContext 勿用；存相册触发微信隐私弹窗机制（`__usePrivacyCheck__`），计划未提。

## 决策点意见

| 决策 | 意见 |
|---|---|
| D1 | ✅ 同意 Taro 4 |
| D2 | ❌ 不接受默认非流式：先实测 enableChunked，失败或确定走云函数再降级 |
| D3 | ✅ 同意首版本地化 |
| D4 | ⚠️ 可接受，但须知它锁死非流式；先核实计费与超时配置 |
| D5 | ✅ 同意 paths 直连优先；注意 `@/*` alias 要在 Taro 同步配置，真正"原样共享"仅 5 个纯函数文件 |
| D6 | ✅ 同意 |
| D7 | 建议首版砍（新 canvas + 相册授权 + 隐私弹窗，性价比低） |
| D8 | ❌ 反对现排序：改 openid+token 为 M3 主线，SMS(mock)不迁 |

## 遗漏项清单

- NumberBoxRandomizer"天降灵数"（RandomizerReel 依赖 framer-motion，M1 需显式列出）
- RelationTabs 错/综/互卦交互迁移
- 云函数/wx.request 超时对齐
- 微信隐私弹窗 + 向 MiniMax 传输用户问题的第三方披露声明
- 企业 vs 个人主体决策
- 显式放弃 BYOK/apiConfig（小程序只走云函数注 key）
- favorites 后端有、Web 前端零使用，移出移植范围
- sessions.expiresAt 校验漏洞

## 处置

以上全部意见已合入 `docs/plans/2026-08-15-orix-miniprogram-port.md`（新增 D9 主体类型、R9 安全风险，修订 §4.2/§5.1/§6/§7/§8/§9/§13）。