# 易象阁微信小程序移植计划

**日期**: 2026-08-15
**状态**: 待架构评审（初稿）
**范围**: 全盘移植规划 —— 前端 SPA → 微信小程序；后端复用为主、适配为辅

---

## 0. 背景与目标

把现有 Web 版易象阁（React SPA + Cloudflare Pages/Worker/D1 + Pages Function AI 代理）移植为微信小程序版本。

**目标**：
- 小程序覆盖 Web 版核心功能：今日卦境、64 卦图鉴、卦详情、三数起卦、AI 解读、我的卦册（本地记录）、社区卦册（feed）
- 复用一切可复用的纯逻辑与数据（`src/lib/` 纯函数、`src/data/` JSON、`src/types/`）
- 后端（Worker + D1）尽量不动，前端换壳
- 控制首版范围，先跑通闭环再打磨视觉

**非目标**：不改后端 schema / 不迁移现有用户数据 / 不做 Web 与小程序数据互通（首版）

---

## 1. 现状盘点（什么能复用、什么必须重写）

### 1.1 可直接复用（纯逻辑，无 DOM）

| 模块 | 说明 |
|---|---|
| `src/data/*.json` | hexagrams.json (281KB) / trigrams.json / relationships.json —— 静态数据源，直接打包进小程序 |
| `src/types/` | Hexagram / UserRecord 等类型定义，TS 直接共享 |
| `src/lib/divination.ts` | 起卦算法，纯函数 ✅（依赖 hexagrams.json，可在小程序运行） |
| `src/lib/daily.ts` | 今日卦境，**依赖 `Intl.DateTimeFormat(timeZone)` —— 需验证小程序 JS 运行时的 Intl 支持，见 4.4** |
| `src/lib/relations.ts` | 错/综/互卦，纯函数 ✅ |
| `src/lib/validation.ts` | 纯函数 ✅ |
| `src/lib/sampleQuestions.ts` | 预置问询数组，纯函数 ✅ |

### 1.2 需适配（逻辑保留，存储/网络层换实现）

| 模块 | 依赖 | 适配方案 |
|---|---|---|
| `src/lib/storage.ts` | localStorage | wx.setStorageSync（同步 API，接口形态一致，改动小） |
| `src/lib/apiConfig.ts` | localStorage / window / import.meta.env | **显式放弃 BYOK**：小程序不提供"填自己的 API Key"，AI 一律走服务端注入 demo key（见 §5.1） |
| `src/lib/ai.ts` | fetch + ReadableStream + TextDecoder + AbortController + SSE | 换 wx.request；流式取舍见 4.2（需 M0 真机实测后定，勿预先写死） |
| `src/lib/feed.ts` | fetch + credentials cookie | 换 wx.request + token 携带（见 §6） |
| `src/lib/auth.ts` | fetch cookie + localStorage | 换 wx.request + wx storage |
| `src/lib/nickname.ts` | localStorage | 换 wx storage |

### 1.3 必须重写 / 舍弃

| 模块 | 现状 | 处置 |
|---|---|---|
| `src/lib/imageGen.ts` | document.createElement('canvas') + 2d context + Blob URL 下载 PNG（ResultDisplay "收藏本卦"按钮、HexagramDetail） | **建议首版砍掉**（小程序 canvas 需 `<canvas type="2d">` 新 API + saveImageToPhotosAlbum 相册授权 + 微信隐私弹窗，性价比低）；需要时用 `<canvas type="2d">` 重写（弃用的 wx.createCanvasContext 勿用） |
| `src/lib/seo.tsx` + react-helmet-async | document.title / meta | 舍弃，换 wx.setNavigationBarTitle（Taro 用 `usePageTitle` 或页面配置） |
| `src/pages/*` + `src/components/*` | React DOM 组件 | **翻译**（JSX 逻辑可平移，宿主元素换 Taro 组件），不是从零重写 |
| framer-motion（13 个文件引用） | Web 动画库 | 换 CSS animation / Taro 基础组件的 animation 属性（动画是锦上添花，可后置） |
| lucide-react | package.json 有声明，但 src 内零引用 | 无影响，不用管 |

### 1.4 调研结论（组件可移植性）

- 卦线组件（HexagramGlyph / YaoLineStack / MiniYaoStack / TwinSpread / YaoLineScroll）**全部是 div+CSS**，非 SVG → Taro 中 div 换 view 即可平移 ✅
- 汉字字体用 `font-display`（思源宋体栈）→ 小程序无系统字体可包，首版用 serif 字体栈 + 可选 `wx.loadFontFace` 加载商用允许的字体（决策点）
- 设计 token（tokens.css 的 CSS 变量）→ WXSS **支持 CSS 自定义属性**（但微信 iOS 端对 CSS 变量支持良好，低版本需确认），可直接复用

---

## 2. 技术选型

| 方案 | 优点 | 缺点 |
|---|---|---|
| **A. Taro 4（React 18 + TS）** ✅ 推荐 | 保留 React 心智模型；JSX 组件逻辑可直接翻译；TS/类型/纯函数库共享成本最低；社区成熟 | Taro 适配层有坑（跨端差异、包体积）；动画库限制 |
| B. 原生小程序（WXML/WXSS/JS） | 最可控、审核最稳、无框架层 | 全部组件重写，React 逻辑也要手翻 state/side-effect，工作量最大 |
| C. uni-app（Vue） | 生态大 | 与现有 React 代码完全不通，等于换语言重写 |

**推荐 A（Taro 4 + React）**：总体逻辑复用率最高，`src/lib` 与 `src/types` 原样共享，React 组件是"翻译"而非"重写"。

> 决策点 D1：技术栈确认（默认 Taro 4）。

**Monorepo 形态**：仓库内新增 `miniprogram/` 目录作为第三个包（与 `server/`、`worker/` 并列），Taro 项目独立 config。通过 tsconfig paths 直接引用根目录 `src/lib`、`src/data`、`src/types`（只读共享，不复制；注意 Taro 的 tsconfig + webpack/taro vite 别名需同步配置 `@/*`）；若 Taro 构建对引用根目录路径有障碍，备选：复制数据 + 纯函数（约 400KB），并保留单测保证同源。**注意：真正"原样共享"的仅 5 个纯函数文件**（divination/relations/validation/sampleQuestions/nickname 部分）——daily.ts 有 Intl 依赖，storage/apiConfig/ai/feed/auth 都要过适配层。

---

## 3. 页面与导航映射

Web 路由 → 小程序页面（小程序无路由库，Taro 按目录生成页面）：

| Web 路由 | 小程序页面 | tabBar | 说明 |
|---|---|---|---|
| `/` Home（今日卦境） | `pages/daily/index` | ✅ | tab 名"今日" |
| `/codex` 64 卦图鉴 | `pages/codex/index` | ✅ | tab 名"图鉴" |
| `/divination` 三数起卦 | `pages/divination/index` | ✅ | tab 名"起卦" |
| `/hexagram/:id` 详情 | `pages/hexagram-detail/index?id=` | | 查询参数传 id |
| `/result/:id` 结果 | `pages/result/index?id=` | | |
| `/records` 我的卦册 | `pages/records/index` | ✅（或并入"我的"） | |
| `/feed` 社区卦册 | `pages/feed/index` | ✅ | tab 名"卦册" |
| `/settings` 设置 | `pages/settings/index` | | 或并入"我的" tab |
| `/yao-design-compare` | 不移植 | | 视觉验收工具页，非产品功能 |
| `*` NotFound | 不移植 | | 小程序无 404 概念 |

**tabBar 上限 5 个**：今日 / 图鉴 / 起卦 / 卦册 / 我的（"我的"聚合 records + settings + 关于）。

**分享**：小程序天然能力 `onShareAppMessage`（Web 版无此功能，这是小程序的新增红利，建议在结果页/详情页开启分享卡片）。

---

## 4. 运行时差异与适配明细

### 4.1 无 DOM / 无 Web API

| Web 依赖 | 小程序替代 |
|---|---|
| React DOM 元素（div/span/button） | Taro 基础组件（View/Text/Button/Input） |
| react-router-dom | Taro 内置路由（navigateTo/redirectTo/switchTab） |
| localStorage | wx.setStorageSync / wx.getStorageSync |
| document.title / meta | 页面 json 配置 navigationBarTitleText + 动态 setNavigationBarTitle |
| Blob/URL.createObjectURL、canvas 下载 | wx.canvas 2d + wx.saveImageToPhotosAlbum |
| window / import.meta.env | Taro 环境常量（process.env.TARO_ENV）+ 编译宏 |

### 4.2 AI 流式（SSE）—— 需 M0 实测，勿预先写死

现状：`generateInterpretation` 用 fetch + stream 逐字渲染 Markdown。

- `wx.request` 的 `enableChunked: true` 自基础库 2.20.2 支持（官方文档未注明 iOS 不支持，架构评审认为需真机实测）
- **真正的硬约束是：微信云开发云函数响应不能流式**。因此流式能力由 D4 网络方案决定：
  - 走云函数代理（D4 默认）→ 必然非流式
  - 走备案域名直连 Pages Function → 流式可行
- **M0 做一次真机实测**（云函数返回 SSE 的行为 + enableChunked）后再定 D2，不给计划写死
- 无论是否流式：保留 `AIError.code` 体系（错误处理映射逻辑原样复用）；`max_tokens 1024` 的非流式请求可能耗时数十秒 → **云函数超时配置须 ≥60s，与 wx.request 超时（默认 60s）对齐**
- 后续可探索：WebSocket 网关代理（成本高，不上首版）

> 决策点 D2：AI 流式取舍——M0 实测后定，默认倾向非流式（云函数路径下无选择）。

### 4.3 网络层改造

Web 版：fetch（浏览器自动处理 cookie / CORS）。
小程序：`wx.request` + Taro 的 `request` 封装，需显式处理：
- header 携带 token（见 §6）
- 错误码映射到现有 `AIError` / feed 错误体系
- **域名白名单**（见 §5）
- 超时控制（wx.request 默认 60s，可配置）

### 4.4 Intl 兼容性风险

`daily.ts` 的 `dateInTimezone` 使用 `Intl.DateTimeFormat('en-CA', { timeZone })`。小程序运行时：
- iOS JavaScriptCore：**支持 Intl**（含 timeZone）
- Android（V8/Chromium）：近年版本支持，**老机型/低版本可能缺失**
- **预案（避免过度设计）**：目标用户几乎全在 Asia/Shanghai（无 DST）。给 `daily.ts` 增加 `getDailyHexagramByKey(dayKey)`（把 dayKey 计算外提），小程序侧适配层自行组装 dayKey：
  - Intl 可用 → 复用 `dateInTimezone`
  - 不可用 → 直接用设备本地日期格式化 YYYY-MM-DD（`new Date()` 的本地时间即为用户时区，**不要 fallback 到 UTC**——UTC 兜底在北京时间 0-8 点会出错误的卦，Web 版 daily.ts:95-101 同样存在该隐患，可顺手修）
- Web 测试已覆盖算法本身，适配层需补测试

---

## 5. 网络与域名策略（最关键的外部约束）

**微信小程序请求域名硬性要求**：https + **ICP 备案** + 在 MP 后台配置 request 合法域名。`*.workers.dev` / `*.pages.dev` 域名**无法配置**。

现状两个外部依赖都需要迁移路径：

### 5.1 AI 解读调用链

Web 版链路：小程序客户端 → `orix-studio.pages.dev/api/proxy/anthropic/*`（Pages Function）→ MiniMax/Anthropic。

| 方案 | 说明 | 成本 |
|---|---|---|
| **A. 微信云开发（云函数代理）** ✅ 推荐 | 云函数转发到 `api.minimaxi.com/anthropic`；复用现有 messages.ts 的 head 过滤 + demo key 注入 + error 映射逻辑（几乎原样搬到云函数）；云函数调用免域名白名单 | **"基础版免费"说法已过期**（2024 年起改订阅制，需核实当前计费）；云函数需配置 ≥60s 超时；出口网络直连 minimaxi.com 无障碍 |
| B. 自有已备案域名 → Cloudflare Worker/云函数外链 | 如果项目方已有备案域名，绑定到 Worker 当反向代理，逻辑同 A，**且可保留流式** | 域名续费 + ICP 备案流程（数周） |
| C. 开发期临时 | 微信开发者工具勾选"不校验合法域名"即可本地联调 | 仅限开发 |

> 数据点：Cloudflare Pages Function 的 proxy 逻辑与云函数几乎是 1:1 可搬（head 过滤 + demo key 注入 + error 映射）。
> **⚠️ 配额现状（架构评审纠正）：Web 端 Pages Function 的 per-IP 配额与 X-AI-Quota 头已在 Phase 2 移除（messages.ts 注释明确"no quota is enforced"），当前 AI 是零限流状态。** 迁云函数后成本敞口真实存在：在云函数内重建 openid/IP 日配额（新写，别引"已有逻辑"），或显式接受无配额并记录成本。现有 `X-AI-Quota` UI 横幅是复用不了的（Web 端已无此头）。

### 5.2 社区 API（Worker + D1）

- 生产：`zhouyi-worker.bringd.workers.dev` —— workers.dev 域名不可用 ❌
- 方案 A：如果走云开发，把 feed/records 的 HTTP 调用**也改成云函数转发**（云函数内用 fetch 带 token 转发到现有 Worker，Worker 完全不用改）
- 方案 B：备案域名方案下，Worker 挂到备案域名即可直连
- 方案 C（首版兜底）：**小程序首版只做本地卦册**（records 存本地），feed 社区功能后置到 M3 —— 拆掉第一道域名墙
- **范围排除**：`/api/favorites` 后端存在但 Web 前端零使用，不移植

> 决策点 D3：社区功能首版是否做（决定 M2/M3 边界与网络方案选择）。

---

## 6. 认证方案

现状：SMS 验证码注册 + `zhouyi_session` HttpOnly cookie（sessionMiddleware 读 cookie 识别 userId）。

小程序无 cookie 机制。**注意现状盲区**：现有 SMS 发码是 mock（`routes/auth.ts` 仅 `console.log` 打码，无真实短信通道）——token 登录不能建立在"短信登录"上，需另起身份来源。

| 方案 | 做法 | 改动面 |
|---|---|---|
| **A. openid + token（评审后推荐主线）** ✅ | 云函数调 `code2Session`（wx.login 的 code）换 openid → 在现有 `sessions` 表/用户体系签发 token（新写一个签发接口，或纯服务端会话）→ 客户端存储 token，请求带 `Authorization` header | worker 加一个小认证端点 + `sessionMiddleware` 加 header 分支；SMS(mock)不迁 |
| B. token（沿用短信登录） | 修好真实短信通道（成本高、需短信服务商），再签发 token | 短信服务接入费 + 后端改 |
| C. 首版不做账号 | 起卦/记录全本地，无身份概念（重力复用 Web 版 localStorage 模式） | 零后端改动，feed 后置 |

**security 红线（评审强调）**：现有 `sessionMiddleware` 对无效凭证**静默铸一个 guest**（session.ts:70-73）；新的 header 分支必须**无效凭证即 401**，严禁落入 guest 铸发流程，否则用户数据串号。顺手修复 `expiresAt` 从未校验的漏洞（session.ts:76-80）。

搭配：首版 C（本地）→ M3 上 A（openid+token）。
另：**个人主体无法调用 getPhoneNumber 且类目受限 → 主体类型（个人 vs 企业）是一个前置决策点**（D9），影响 M3 与类目策略。

---

## 7. 数据与包体积

- `hexagrams.json` 281KB + `trigrams.json`（**注意：`src/data/` 没有 relationships.json**，架构评审指正）——合计 < 350KB，**主包上限 2MB 内放得下**（源码+依赖预估整体 ~1MB），无需分包（超出再分）
- 关键约定：**小程序内消费同一份 JSON**，不允许两份拷贝产生分叉；用脚本/CI 断言两版本哈希一致（可选）
- 今日卦境的时区输入：`Intl` 可用则设备时区；不可用 fallback 本地偏移

---

## 8. 视觉还原策略

- `styles/tokens.css` 的颜色/字体变量 → `app.wxss` 的 CSS 变量 + 语义化类名（WXSS 支持 CSS 自定义属性；兼容目标：基础库 ≥ 2.9.0）
- **Tailwind 迁移（评审纠正：全站 Tailwind 3，工具类数百个，"手写 30 类映射"不可行）**：方案改为在 `miniprogram/` 内跑 `tailwindcss` CLI 扫描 Web 源码（`../src/**/*.tsx`）生成实际使用到的工具类集合 → 输出为 WXSS，作为 `app.wxss` 的一部分（在 Taro 小程序里不引 tailwind 运行时，只引编译产物）
- 国风动漫按钮/印章/卦线：div → View 平移，阴影用 box-shadow（WXSS 支持）
- 字体：系统 serif 栈（`serif` / 「Songti SC」/「SimSun」等），`wx.loadFontFace` 加载思源宋体作为渐进增强
- 动画：framer-motion 换 CSS keyframes + Taro 的 `animation` 属性；首版仅保留必要动效（FlipEntry 简化为淡入）
- **动效依赖清单（评审提醒，M1 就要显式处理）**：NumberBoxRandomizer 的"天降灵数"滚动（RandomizerReel 依赖 framer-motion）与 RelationTabs 错/综/互卦切换是 Web 版核心交互，移植时不能只翻译成静态态，需逐项确认动画在新栈的实现方式

---

## 9. 里程碑

| 阶段 | 内容 | 交付物 | 依赖 |
|---|---|---|---|
| **M0 决策与基建** | 确认 D1-D9（含主体类型）；注册 AppID；`miniprogram/` 脚手架（Taro 4 + TS）；数据/纯函数共享 + TS alias 打通；**真机实测：云函数 SSE 行为 + enableChunked + Intl 可用性**；CI 冒烟 | 可编译的空壳小程序 + D2 实测结论 | 用户决策 |
| **M1 核心闭环（首版体验）** | 今日卦境 / 64 卦图鉴 / 卦详情 / 三数起卦（含天降灵数交互）/ 起卦结果 / 本地卦册；设计 token 移植 + Tailwind 扫描产物；tabBar；关系卦 RelationTabs | 完整可用的"起卦-看卦-记录"闭环 | M0 |
| **M2 AI 解读** | 云函数代理（搬 Pages Function 逻辑 + 决定是否重建 AI 日配额）；流式按 D2 实测结果；错误映射；解读写入本地记录；云函数超时 ≥60s | AI 解读可用 | M0（云开发开通） |
| **M3 社区与账号** | openid + token（code2Session 签发；sessionMiddleware 加 header 分支：无效即 401）；feed 列表/发布/回复；结果页分享发布；"我的"页（设置/昵称）；隐私弹窗 `__usePrivacyCheck__` 适配 | 社区闭环（云函数转发打通） | M2 + D3 + D9 |
| **M4 打磨与上架** | 视觉逐页对照 Web 版；动效补全；隐私指引/用户协议；类目与文案合规化；向外部 AI 服务方的第三方披露声明；提审 | 发布上架 | M3 |

工作量粗估：M1 ~40%、M2 ~15%、M3 ~25%、M4 ~20%（相对整体）。每个阶段结束跑通小程序开发者工具真机预览。

---

## 10. 测试策略

- `src/lib` 纯函数：**原样共享 + 现有 vitest 单测继续覆盖**（这是最大的测试资产）
- 适配层（storage/网络/时区 fallback）新增单测（内存 mock wx API）
- Taro 组件测试（@tarojs/test-utils + miniprogram-simulate）只覆盖关键交互（起卦表单、结果页），优先级低
- 手工验收：微信开发者工具（模拟器 + 真机预览），对照 Web 版截图逐页过

---

## 11. 合规与审核风险（不可忽视）

| 风险 | 说明 | 缓解 |
|---|---|---|
| 占卜/迷信类目拒审 | "三数起卦"+AI 解读最容易被归类为封建迷信占卜，这是**最大上架风险**；个人主体可选的类目更受限 | ① 类目选"教育 > 传统文化"或"工具 > 生活服务"而非占卜类；② 全站文案规范：强调"周易文化研究/自我觉察工具"，去除"预测/算命/吉凶"表述；③ AI 系统提示词追加合规约束；④ 准备申诉材料（文化研究定位）；⑤ 主体类型（D9）前置确认 |
| 隐私合规 | 收集手机号（M3）、问题文本、AI 解读、用户反馈；**问题文本会传输给外部 AI 服务商** | 首版只收集问题文本+解读（存本地）；M3 起配合微信隐私弹窗机制（`__usePrivacyCheck__` + 隐私保护指引声明）；提交《用户隐私保护指引》时**向用户披露第三方 AI 服务商** |
| 未成年人保护 / 诱导分享 | 命理类内容审核红线 | 不诱导分享得利；分享卡片文案中性 |

---

## 12. 风险清单汇总

| # | 风险 | 影响 | 概率 | 缓解 |
|---|---|---|---|---|
| R1 | 审核拒审（占卜类目） | 致命 | 高 | §11 文案/类目合规；个人主体类目受限 → 提前定 D9 主体类型 |
| R2 | 无备案域名，社区 API 无法直连 | 阻塞社区功能 | 高 | 云函数转发 / 备案域名 / 首版本地化 |
| R3 | AI 流式不可用，体验降级 | 中 | 待爬 | M0 实测；云函数路径下接受非流式 + loading 设计 |
| R4 | Intl timeZone 在老安卓缺失 | 今日卦境错卦 | 低 | 设备本地日期 fallback（**勿落 UTC**，Web 版 UTC 兜底顺手修） |
| R5 | Taro 对根目录共享代码（lib/data）构建支持不佳 | 工期延迟 | 中 | 备选：复制 + 哈希断言保同步 |
| R6 | 包体积超限（如引入图表/字体） | 发布失败 | 低 | 281KB 数据可控，超限再分包 |
| R7 | 三端状态不同步（Web 卦册 vs 小程序卦册） | 体验割裂 | 中 | 明确首版不互通（写进 README），M3 后评估云同步 |
| R8 | 云开发费用超预期（AI 调用量 + 订阅制费改） | 成本 | 中 | **AI 现为零限流**：云函数内重建 openid/IP 日配额，或显式接受并记录成本；核实 2024 起订阅制计费 |
| R9 | token-in-header 分支静默铸 guest → 用户串数据 | 数据安全 | 中 | 无效凭证即 401，严禁落入 guest 铸发；顺修 expiresAt 未校验漏洞 |

---

## 13. 待拍板决策点汇总

| 编号 | 决策 | 默认建议 |
|---|---|---|
| D1 | 技术栈 | Taro 4 + React 18 + TS |
| D2 | AI 流式取舍 | **M0 真机实测后定**（云函数路径下无流式选项；备案域名直连可保留流式） |
| D3 | 首版是否含社区 feed（否则拆域名墙后置） | 建议首版本地化，M3 再做 |
| D4 | 网络方案 | 云开发（云函数代理 AI + 转发社区 API）；**须知它锁死非流式 + 需核实订阅制计费** |
| D5 | 数据共享形态 | tsconfig paths 直连共享；失败则复制+哈希断言 |
| D6 | 字体 | 系统 serif 首版，loadFontFace 渐进增强 |
| D7 | 下载卦象卡（imageGen） | **建议首版砍**（canvas 新 API + 相册授权 + 隐私弹窗，性价比低） |
| D8 | 账号体系 | 首版无账号（本地）；M3 主线 = **openid + token**（code2Session 签发），SMS(mock)不迁 |
| D9 | **主体类型（新增）** | 个人主体入门即可（类目受限、无 getPhoneNumber）；要 M3 社区/手机号能力需企业主体，提前规划 |

---

## 14. 建议的下一步

1. 本文档交架构 Agent 评审（对接：`docs/plans/2026-08-15-orix-miniprogram-port-review.md`）
2. 用户确认 D1-D8
3. M0 落地：注册小程序 AppID → `miniprogram/` 脚手架 → 共享链路验证（编译出 tabBar 空壳）