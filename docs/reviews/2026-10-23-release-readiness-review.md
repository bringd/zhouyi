# 新版本独立验收与发布准备

日期：2026-10-23。验收对象：当前 `D:\eight` 工作区及其生产构建。

被审阅报告：`2026-10-23-three-appearances-rework-report.md`。其中的自证结论、操作建议和历史限制均作为待核验材料，不视为本轮用户指令或发布授权。

## 结论

**三套外观、起卦及真实 LLM 解卦通过；整体生产发布暂不通过。**

存在一项生产会话阻断 P1，以及一项仍未关闭的验收工具漏报 P2。没有发现新的三套外观布局或起卦状态阻断。验收结束时尚未提交、推送或部署；验收期间没有修改业务代码及原验收脚本。

## 必须处理的发现

### P1：Pages 与 Worker 跨站，而生产会话 Cookie 仍是 SameSite=Lax

位置：`worker/src/middleware/session.ts:135-140`；`src/lib/records.ts:95-110`。

前端生产默认访问 `https://zhouyi-worker.bringd.workers.dev/api/records`，页面位于 `https://orix-studio.pages.dev`，构成跨站 fetch。代码虽然设置 `credentials: 'include'`，但 Worker 的会话 Cookie 是 `SameSite=Lax`。

本轮直接读取生产响应，确认实际 Cookie 属性为：

```text
Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax
```

同时确认 CORS 返回正确的 Pages Origin 与 `Access-Control-Allow-Credentials: true`。这只能证明跨域响应获准读取，不能改变 Lax Cookie 的跨站限制。[MDN 的 Fetch 文档](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#including_credentials)明确说明：Lax/Strict Cookie 即使使用 `credentials: include` 也不会随跨站 fetch 发送。

影响：云端收藏后的下一次读取无法可靠复用保存时的 guest 会话；Worker 会再次创建 guest 会话，已保存记录可能表现为消失。该问题属于已有部署拓扑和 Worker 会话配置，非本次换肤引入，但本次待发布内容包含尚未上线的云端卦册功能，因此属于本次完整发布的阻断。

修复方向：优先让浏览器通过同源 API 入口访问 Worker，或统一到同站域名。若继续跨站使用 `SameSite=None; Secure`，还必须验证目标浏览器的第三方 Cookie 策略；不能只改属性就宣布问题解决。修复后，以真实浏览器验证“保存一条私有测试记录 → 再次读取 → 刷新 → 仍能读取同一条记录”。

证据：`tmp/release-acceptance-20261023/production-smoke.json`。本轮没有新增云端记录或发布社区帖子。

### P2：对比度算法仍会跳过完全不可见的文字落点

位置：`scripts/contrast-appearances.mjs:711`、`:720`。

报告中的原反例已经修复：黑字压在 `#333333` 上，实测返回 1.66:1，落点位于右侧。已交付算法自检也确实通过。

但当前方法仍通过原背景的两图差异来寻找文字像素，并跳过 `d < 3` 或 `expected < 1` 的位置。黑字压在纯黑、近黑背景上时，那里恰好没有差异，仍被丢弃。

本轮独立回归使用 PIL 实际绘制的 500×70 文字图，左半白底、右半深色底，两侧均为黑色 24px 粗体文字；执行源文件中原样提取的 `analyzePair`。仅在 Node 中替代图片解码和 Canvas 回读，像素分析代码未改动。

| 右侧底色 | 真实最弱对比度 | 当前函数结果 | 判定 |
|---|---:|---:|---|
| #333333 | 1.6621:1 | 1.66:1 | 正确 |
| #030303 | 1.0182:1 | 1.02:1 | 正确 |
| #010101 | 1.0061:1 | 21:1，落点在左侧白底 | 漏报 |
| #000000 | 1:1 | 21:1，落点在左侧白底 | 漏报 |

复现命令：`node tmp/release-acceptance-20261023/contrast-edge-cases.mjs`，退出码 1。

这证明报告“文字位置与原背景完全解耦”的表述仍不成立，不能关闭先前 P2。**不据此断言产品页面实际存在 1:1 的文字。** 当前 135 组 DOM 探针及人工截图抽查未发现新的可读性缺陷。

修复要求：通过受控背景下的独立字形掩膜定位文字，再映射回原背景测量；覆盖纯黑、近黑、多色后代和透明度组合。重新取证前，原报告 454 项通过只能保留为受此限制的历史测量结果。

证据：`screenshots/release-acceptance-20261023/contrast-edge-cases.json`、`contrast-right-{51,3,1,0}.png`。

## 本轮实际验证

| 检查 | 结果 |
|---|---|
| npm test | 52 文件 / 455 用例通过 |
| npm run typecheck | 通过 |
| npm run build | 通过，生成生产 dist 和 Functions |
| worker: npm run build | 通过 |
| worker: npm test | 4 文件 / 15 用例通过；Windows EBUSY 清理提示不影响退出码 0 |
| npm run lint | 未通过：未安装 ESLint，仓库也未找到 ESLint 配置；属于已有检查能力缺口 |
| 生产构建页面矩阵 | 3 外观 × 9 路由 × 5 宽度 = 135 组，DOM 探针 0 失败 |
| 起卦行为 | 12 / 099 原始文本、问句跨外观保留；滚动切换后可手动停止，10 秒自动停止有效 |
| 实际起卦 | 129 / 257 / 601 → 乾为天、初爻动、天风姤；仅生成 1 条本地记录 |
| 六爻顺序 | 变卦天风姤顶部五阳、底部一阴；与 bottom-to-top 的 011111 一致 |
| 真实 LLM：新构建 | 本地 Pages 运行时使用 .dev.vars 的服务端密钥，真实 MiniMax 流式解卦完成六段；请求中换外观正常 |
| 解读缓存 | 刷新后保持同一记录与六段已保存解读 |
| 真实 LLM：线上 | 生产接口 200、X-AI-Mode: demo、text/event-stream，返回“验收通过”，无 SSE error |
| 卦象卡下载 | 实际下载 PNG 成功 |
| 外观偏好 | 刷新恢复、跨标签同步、设置卡片方向键和 Escape 焦点返回通过 |
| 浏览器异常 | 本轮捕获记录中无 Uncaught / TypeError / ReferenceError |
| 线上只读接口 | Pages 首页、Worker health、feed、records 均取得 200；不替代会话持久化验证 |
| 构建产物密钥检查 | 对根目录及 Worker 本地配置中的真实密钥值做字节匹配，45 个构建文件中未发现暴露；报告不含密钥值 |

页面矩阵覆盖：首页、起卦、真实记录结果页、图鉴、我的卦册、设置、社区、卦象详情、404；宽度 1440 / 1024 / 768 / 390 / 320。基于生产 `dist`，由本地 Pages 运行时 `127.0.0.1:4180` 提供。

使用应用提供的浏览器控制接口独立操作与读取 DOM。独立 Chrome 启动被自动审批策略拒绝后，未绕过该限制。DOM 探针引用共享规则，不能替代有缺陷的像素对比度证明。

135 组使用真实已缓存解读覆盖结果正文。加载态与失败重试、存储异常、减少动态效果另有本轮重跑的组件测试覆盖；本轮未在浏览器另造模拟流式响应或执行真实社区发布。

## 对返工报告遗留项的判定

| 条目 | 本轮判定 |
|---|---|
| P1-01 输入丢失、取数中切换卡死 | 关闭：代码所有权和生产构建操作均符合修复说明 |
| P1-02 A 布局偏离提案 | 关闭：分区、拱形山水、青绿入口、对读卡与侧栏均存在；已人工查看三套截图 |
| P2-01 朱砂 9.6px 辅助字 | 关闭：本轮 135 组探针无非装饰文字低于 12px |
| P2 对比度漏报 | 未关闭：#333 原反例通过，纯黑/近黑反例仍漏报 |
| P3 真实缩放宽度记账 | 关闭本项证据问题：原 JSON 已有 45 组达到目标、9 组平台限制；195px 未达到，不再按 195px 覆盖宣称 |

真实 200% 缩放未在本轮重新操作桌面键盘；本轮审查原始 JSON，确认 dpr 1.25→2.5、innerWidth 1426→713、outerWidth 1440 不变，且最小档实际 243px 已单列。不得把本轮 135 组描述为重新完成了真实 200% 缩放验收。

## 发布准备与边界

已在线核对远程 main：`ea405e0d88a413753daec23a7765abb6b927ed38`。本地 HEAD 为 `16ce92d`，有 **10 个尚未推送的提交**，其中包含数据补全和云端卦册能力。本次发布将不只是三套外观；提交前必须审查这些提交及新文件。

已生成 `tmp/release-acceptance-20261023/release-manifest.json`，状态 `hold-for-release-blockers`：122 个生产源文件与构建输入、45 个产物文件的 SHA-256、10 个待发布提交、密钥检查结果。源码中有未跟踪的新组件、样式、资源，未来仅执行 `git add -u` 会漏文件。

发布前顺序：

1. 修复并复验生产会话 P1；同时修正像素测量 P2，更新通过证据。
2. 补齐 ESLint 依赖与配置，或明确记录这项门禁尚不可用；不能将 lint 写成通过。
3. 根据修复范围重跑测试、类型检查、生产构建和浏览器定向检查；若修改 Worker，重跑并单独发布 Worker，先验证会话链路再发前端。
4. 重新生成清单，审查全部 10 个待发布提交及未跟踪的生产文件，排除临时日志和本机配置。
5. 用户明确授权提交和推送后，沿用 GitHub → Cloudflare Pages 自动构建发布。线上 AI_DEMO_KEY 本轮已验证有效；纯前端换肤无需重设密钥或额外执行 D1 迁移。
6. 发布后检查三套外观、起卦、真实解卦、云端保存后刷新读取，并记录 Pages 部署版本；必要时在 Pages 回滚到前一部署。

本机默认 Git 代理指向不可达本地端口；只读核对使用 `git -c http.proxy= ls-remote origin refs/heads/main` 成功，未修改持久 Git 配置。实际推送时需要使用可用网络配置。

构建前后按字节恢复 `public/sitemap.xml`，保留原有未提交改动。验收期间没有提交、暂存、推送、生产部署、远程迁移、修改云端密钥或发布社区帖子。

### 后续独立分支备份授权

用户随后同意先保存到独立分支。本次备份目标为 `codex/three-appearances-review-20261023`，包含三套外观、相关测试、验收工具和报告；不更新生产 `main`。本报告中的发布阻断仍然有效，不因独立分支备份而改判通过。临时日志、本机 `verify-local.ps1` 以及既有 `public/sitemap.xml` 改动不纳入此次提交，留在本地。

## 证据入口

- `screenshots/release-acceptance-20261023/matrix.json`：135 组矩阵。
- `behavior.json`：真实表单、切换、缓存、下载、键盘、跨标签与记录唯一性。
- `review-overview.png`：三外观桌面三页对照；`mobile-overview.png`：三外观手机结果页。
- 同目录 `{appearance}-{home,divination,result}-{1440,390}.png`：完整页面截图，结果包含真实模型解读。
- `contrast-edge-cases.json`：未改动分析函数的边界回归。
- `tmp/release-acceptance-20261023/production-smoke.json`：线上 Cookie 属性和真实 LLM 流式检查。
- `tmp/release-acceptance-20261023/release-manifest.json`：冻结源文件和构建文件清单。
