# 三套外观实施交付说明（青岚书院 / 朱砂档案 / 夜航观象）

- 实施日期：2026-10-23（第一轮与独立验收返工轮，同日）
- 需求来源：`docs/plans/2026-10-23-three-appearances-implementation-brief.md`
- 独立验收报告：`docs/reviews/2026-10-23-three-appearances-acceptance.md`（第一轮「本轮不通过」，4 项缺陷）
- 返工报告：`docs/reviews/2026-10-23-three-appearances-rework-report.md`（逐条缺陷的处理与复验路径）
- 第二轮复验：`docs/reviews/2026-10-23-three-appearances-reacceptance.md`
  （结论「功能和 A 方案视觉返工通过；完整验收暂不关闭」，留 1 项 P2 + 1 项 P3；
  处理结果见返工报告 §0 与本文 §0.1.1 / §7.2.1 / §7.1.3）
- 状态：**已实施，未提交 / 未推送 / 未部署**（工作区保持未提交 diff）

---

## 0. 需求对照表（brief 逐条）

### 0.1 第一轮之后的返工项（独立验收报告的 4 条缺陷）

| 验收报告条目 | 状态 | 处理与证据 |
|---|---|---|
| **P1-01** 切换外观会卸载输入框与随机取数器 → 丢失输入、启卦被卡死 | ✅ 已修 | 原始文本 + 三个取数控制器整体上移到稳定层 `useNumberBoxesState`（`src/components/ui/NumberBoxRandomizer/state.ts`），`NumberBox` / `NumberBoxWithRandomizer` 改为**完全受控**；视图换成受控 props（`CastAppearanceProps`），外观切换不再卸载子树。回归见 §7.4 `AppearanceSwitchKeepsCastState.test.tsx`（6 例）与 §7.3 走查末尾的 P1-01 专项段 |
| **P1-02** 青岚书院用的是提案之前的旧页面，不是 A 提案 | ✅ 已修 | A 的三页视图按 `/design-preview?direction=a&page=home\|cast\|result` **整体重做**（新文件 + 新命名空间 `ql-` + 三个新样式表），A 的语义令牌换成提案自己的青绿色板。见 §3.3 / §3.4 |
| **P2-01** 朱砂档案「已选定 x / 3 个灵数」9.6px | ✅ 已修 | `.zh-status small` 显式写 `font-size: var(--text-caption)`（12px），不再靠 `<small>` 的 80% 继承；验收矩阵 `字号<12px=0` |
| **P2-02** 验收脚本不足以支撑「0 失败，全部完成」 | ✅ 已修 | ① 横向溢出不再只记录，计入失败；对比度/字号/目标尺寸全部进入失败判定，失败即非零退出；② 200% 拆成「模拟矩阵」与**独立的真实浏览器缩放验收**（`scripts/zoom-real-200.mjs`，真实缩放已验证）；③ `cssW < 320` 的 195px 档改为**显式豁免**并逐条打印理由，不再静默省略；④ 页面矩阵补齐 `/feed` 与 404，加载/错误态进矩阵；⑤ 对比度脚本改名并补上「最弱落点」判定，缺项计入失败。见 §7.1 / §7.2 |

### 0.1.1 第二轮复验遗留的两项（复验报告的 P2 / P3）

| 复验条目 | 状态 | 处理与证据 |
|---|---|---|
| **[P2]** 对比度仍在「变化最强的区域」取样，漏掉最弱落点 | ✅ 已修 | 文字位置识别与背景对比度**彻底解耦**：位置改由**覆盖率 α 掩膜**给出（`α = \|P−B\| / \|eff−bg\|`，`eff` 为该片段自身字色按 opacity 合成到底色上的结果），不再用「全局最大差值 90%」当取样门槛；多色后代按各自文本节点父元素的计算色配对；新增 `runAlgorithmSelfTest()` **算法回归**（复验方的黑字压 `#333` 反例必须判失败并进失败列表、单色合格样例必须保持通过），在正式测量前执行、失败即 `process.exit(1)`。另修两处忠实度：元素 `opacity` 参与字色合成（朱砂水印由虚报 5.58:1 改为真实 **1.26:1**）、只在页面稳定（无有限动画在跑）时测量（避免把入场淡入的 0.05 中间态当字色）。详见 §7.2.1 |
| **[P3]** 真实缩放最小档标称 195px、实测 243px 仍按 195px 记账 | ✅ 已修 | `zoom-real-200.mjs` 逐组核对 `actualCssWidth` 与 `requestedCssWidth`，偏差 > `WIDTH_TOLERANCE`(20px) 即判**没量到标称档位**，单列为 `platformLimited` 写进报告 `platformLimits`，并更正档位名称与说明（不按 195px 记账，按实测 243px 记账）；报告每行新增 `widthDeviation` / `widthMatched` / `effectiveTier`。详见 §7.1.3 |

### 0.2 brief 逐条

| brief 要求 | 状态 | 证据 |
|---|---|---|
| A/B/C 三套外观全部保留为可选外观，默认 A | ✅ | 根节点 `data-appearance` 默认 `qinglan`；`tests/lib/appearance.test.ts`、走查脚本首项断言 |
| 首页/起卦/结果三页各保留三套布局，接入正式业务 | ✅ | `src/components/appearances/{qinglan,zhusha,yehang}`；三套首页/起卦/结果截图 |
| 预览里的示例解读/示例记录/演示交互不作为业务实现 | ✅ | 走查脚本用真实三数 123/456/789 起卦 → 真实记录 ID → 结果页读真实记录；AI 走正式入口按钮，未预置静态回答；A 提案里那枚「一次摇三个数」的演示按钮**没有实现**，三个灵数各自走正式取数逻辑 |
| 不 commit / 不 push / 不部署，保留他人未提交改动 | ✅ | `git log` 顶端仍是 `16ce92d`；`public/sitemap.xml` 等他人改动原样保留（构建后已还原 lastmod） |
| 设置页三张卡片（名称/缩略/说明/选中态） | ✅ | `src/components/layout/AppearancePicker.tsx`，截图 `*-settings-*.png` |
| Header「外观」快捷入口，桌面+手机可操作，共享同一状态 | ✅ | `AppearanceSwitcher.tsx`；`tests/components/AppearanceSwitcher.test.tsx`（顶栏↔设置页同步） |
| 点击即生效，不刷新不二次保存 | ✅ | 走查脚本用真实 UI 点击切换，根节点属性与 localStorage 立即变更；无 reload |
| 选中态不只靠颜色 | ✅ | 勾号图标 + `aria-checked` + 文字（`menuitemradio` / `radio`） |
| 刷新/关闭重开/直接进任意路由仍保持选择 | ✅ | 走查脚本刷新后仍为夜航观象；定向用例「刷新后仍保持此前选择」 |
| 无偏好/非法值/旧设置 → 默认 A | ✅ | `normalizeAppearance()` + 三个定向用例 |
| 不被系统深浅色偏好覆盖 | ✅ | `theme: 'light'` 语义原样保留，外观独立字段 |
| 存储不可用仍可会话内切换 + 非阻塞说明 | ✅ | `saveAppearance()` 返回 false → `role="status"` 提示；定向用例覆盖 |
| 冷启动/刷新不闪浅色（尤其 C） | ✅ | `index.html` 预绘脚本首帧前写属性 + 内联底色；实测导航前属性已生效 |
| 键盘可打开/选择/关闭并回到触发位置，选中态语义正确 | ✅ | 方向键/Esc/Tab 定向用例；`aria-checked`、`aria-haspopup`、`aria-expanded` |
| 切换不丢问题/三数/校验状态 | ✅ | 稳定层持有（见 P1-01）；走查脚本 + 组件用例覆盖**未满三位 / 无效三位 / 滚动中 / 停止后再切换**四类，六个切换方向都覆盖 |
| 切换不丢记录 ID/卦象/动爻/AI 内容/错误重试状态 | ✅ | `tests/components/AppearanceSwitchState.test.tsx`；走查脚本刷新后同一条记录 |
| 切换不重复发请求、不截断内容、不清缓存 | ✅ | 走查脚本用 CDP 统计 `/api/` 请求：切换前后新增 = 0 |
| 切换不重复执行云端保存/社区发布副作用 | ✅ | 同上；组件测试断言发布只调用一次 |
| 保留路由与滚动位置 | ✅ | 走查脚本切换后 URL 不变；视图替换不卸载页面容器 |
| 切换本身不创建记录/不调 AI/不自动保存/不发布 | ✅ | 走查脚本：启卦与切换期间 `/api/` 新增请求 = 0 |
| 复用三数起卦算法，六爻自下而上 | ✅ | 复用 `src/lib/divination.ts`；`hexagramLines` / `YaoLineStack` 用**阴阳混合卦（地天泰）**验证顺序 |
| 首页用真实今日卦/日期/时区 | ✅ | 走查截图首页显示 2026/10/23 与本地时区；`src/lib/daily.ts` 未改 |
| 结果页按真实记录渲染，缺失记录正常回退 | ✅ | 真实记录渲染已验证；缺失记录回退由既有 `ResultDisplay` 用例覆盖 |
| AI 沿用正式鉴权/流式/错误码/缓存 | ✅ | 结果页 AI 入口复用原 `ResultDisplay` 逻辑，未包装静态示例 |
| 保留云端保存说明、发布前公开提示与错误反馈 | ✅ | 既有实现未改；截图可见「云端卦册加载失败：HTTP 500」的优雅降级 |
| PNG 下载保留现有数据与行为 | ✅ | 未改动该逻辑；本轮不要求三套导出皮肤 |
| 不新增后端协议、不动废弃 server/ | ✅ | 改动全部在前端；`worker/` 零改动 |
| 一份业务状态，不复制三份 AI/存储/发布逻辑 | ✅ | 状态持有者在 `Home`/`DivinationForm`/`ResultDisplay`，外观目录只含表现组件 |
| 颜色走语义令牌，插画内部颜色可独立 | ✅ | `src/styles/appearance.css` 令牌覆盖；旧调色板变量逐套重映射 |
| 外观挂在统一根节点的稳定 data 属性 | ✅ | 仅 `<html data-appearance>`；无 aria-label 承载、无深层 DOM 选择器刷皮肤 |
| 保留布局区别，不只是换色 | ✅ | 三套首页/起卦/结果结构不同（浅纸山水左右分区 / 印版书册 / 星图观测面板） |
| 正文 14–16px，辅助文字 ≥12px | ✅ | 验收脚本 CSS 走查 `<12px=0`；朱砂「已选定 x / 3」9.6px 已修 |
| 对比度按实际合成背景（渐变/山水/星图）验收 | ✅ | `contrast-appearances.mjs` 像素级实测 **454 处，0 失败**；判定用「文字真实颜色落在最不利底色上」的最小值，最低 **4.83:1**（青岚起卦页「启 卦」按钮）。文字位置由**覆盖率 α 掩膜**识别，与对比度数值解耦；反例已进算法回归（§7.2.1） |
| 普通文字 ≥4.5:1，大字 ≥3:1，装饰明确区分 | ✅ | 同上；豁免项只有 4 条 `aria-hidden` 装饰（山水图注/题刻、卦名水印 ×2），每条都写明理由 |
| 点击目标 ≥24×24，手机主按钮约 44px | ✅ | 验收矩阵 `目标<24px=0`；本轮补齐了 30 条 `min-height:24px` 规则（青岚/朱砂/夜航/旧页面样式表）与 2 处 TSX 内的 `min-h-6`（灵数 label、所问之事 label、「再起一卦 →」、「返回首页」、面包屑「首页」） |
| reduce 模式覆盖 CSS/页面切换/随机数字/Framer Motion | ✅ | 验收脚本开/关两种模式跑同一滚轮：不透明度恒定 vs 持续变化 |
| C 外观输入/占位/弹层/错误/禁用/加载/缓存/Markdown 可读 | ✅ | C 三页截图 + C 全量对比度实测 + 旧页面 C 态截图 |
| 404 等页面在三种外观下可读可用 | ✅ | 验收矩阵覆盖 codex/records/settings/hexagram/feed/notfound 六类旧页 × 三外观 × 五宽度 |
| /design-preview 保留为对照入口，不污染正式偏好 | ✅ | 未改该页；它不写 `zhouyi:settings.appearance` |
| 门禁 1–4 全部执行 | ✅ | 见 §6 |
| 定向用例（默认 A、选 B/C、刷新恢复、非法回退、旧设置、存储失败、顶栏↔设置同步、输入保留、真实数字成卦成记录、结果页不丢状态不重复请求、阴阳混合爻序、错误处理不回归） | ✅ | 见 §7.3 / §7.4 用例表 |
| 构建不改写 sitemap、不整理无关改动 | ✅ | 构建后已还原 `public/sitemap.xml`；`vite.config.ts`、`src/lib/apiConfig.ts` 等他人改动原样保留 |
| 浏览器矩阵（3 外观 × 9 页 × 5 宽度 + 模拟 200% + 结果四态）**与真实浏览器 200% 缩放（单独做）** | ✅ | 见 §7.1：矩阵 135 + 模拟 200% 27 + 结果四态 12 = **174 组全覆盖**；真实缩放见 §7.1.2，**已验证** |
| 行为序列（选 B→填数→切 C→启卦→切 A→AI/保存/发布→刷新→卦册） | ✅ | `scripts/appearance-journey.mjs`，**35 项断言全通过**（含 P1-01 回归段） |
| 证据有效性（先断言导航成功；无连接失败/空页/遮罩/缺记录页；不以固定 sleep 或「无滚动条」为唯一标准） | ✅ | 四个脚本均轮询断言 + 采集请求数 + 失败即判失败 |
| 交付 6 项内容 | ✅ | 本文 §4/§5/§6/§7/§9/§10 与 §11 |
| 模拟接口不得据此声称真实联调通过 | ✅ | §10 明确标注 AI/云端为 mock |

**唯一未做（brief 明确不要求）**：三套外观的 PNG 导出卡片皮肤；旧业务页面（图鉴/卦册/社区/详情/404）的逐页重新设计（只换肤、不改版）。

---

## 1. 一句话概述

把设计预览里的 A「青岚书院」/ B「朱砂档案」/ C「夜航观象」落成站点上**三套可切换、可持久化、互不干扰**的外观：
外观只是一个 `<html data-appearance="…">` 属性 + 一套语义令牌 + 三套视图组件，业务状态（表单、卦象、AI 流式解读、收藏/发布、记录）只有一份，
切换外观不重挂载、不刷新、不跳转、不重新请求。

---

## 2. 外观偏好键与兼容策略

| 项 | 值 |
|---|---|
| 存储位置 | `localStorage` 键 `zhouyi:settings`（与既有 `preferredLocale` / `theme` 同一个对象） |
| 字段 | `appearance: 'qinglan' \| 'zhusha' \| 'yehang'` |
| 默认值 | `qinglan`（A 青岚书院） |
| 白名单 | `src/lib/appearance.ts` 的 `APPEARANCE_IDS` / `isAppearanceId()` / `normalizeAppearance()` |

兼容策略（逐条对应 brief 的「无效值 / 旧设置 / 存储不可用」）：

1. **默认值**：没有 `appearance` 字段的老用户 → 归一化为 `qinglan`（A）。不写任何迁移脚本。
2. **无效值**：`appearance: 'foo'` / 数字 / `null` → `normalizeAppearance()` 一律回落到 `qinglan`。
3. **旧设置兼容**：`getSettings()` 仍然是 `DEFAULT_SETTINGS + 存量` 的合并语义，外观只是其中一个新字段；
   写入时只改 `appearance`，其余字段（`preferredLocale` / `theme`）原样保留（有单测覆盖）。
4. **存储不可用**：`saveAppearance()` 返回 `false` → 外观**本次会话内仍可切换**，同时在切换器下方给出
   `role="status"` 的非阻塞提示「浏览器存储不可用，外观选择只在本次会话中生效。」
5. **冷启动不闪**：A/B/C 的差异全部来自 CSS 变量，`<html>` 上的 `data-appearance` 由 `index.html` 的
   **预绘内联脚本**在首帧之前写入（读取并校验 `zhouyi:settings`）→ 深色的 C 不会先闪一下浅色。
6. **多标签页同步**：监听 `storage` 事件，另一个标签页改外观，本页也会跟随。

---

## 3. 实现概览

### 3.1 分层

```
表现层（三套外观）
  src/components/appearances/
    shared/{types.ts,CastFormShell.tsx}   ← 跨外观共享的契约与表单外壳
    qinglan/{HomeQinglan,CastQinglan,ResultQinglan}.tsx   ← A（按 A 提案重做）
    zhusha/{HomeZhusha,CastZhusha,ResultZhusha,parts}.tsx ← B
    yehang/{HomeYehang,CastYehang,ResultYehang,YehangAtlas}.tsx ← C
    registry.ts    ← AppearanceId → 视图组件 的唯一映射表

业务状态层（唯一一份）
  src/pages/Home.tsx                 ← 持有今日卦境状态
  src/components/sections/DivinationForm.tsx  ← 持有问题/三数/取数/校验
  src/components/sections/ResultDisplay.tsx  ← 持有记录/AI 流式/收藏/发布/下载
  src/components/ui/NumberBoxRandomizer/state.ts  ← **稳定层**：灵数原始文本 + 三个取数控制器

外观上下文
  src/lib/appearance.ts   ← 白名单、归一化、选项元数据
  src/contexts/AppearanceContext.tsx  ← 当前外观 + 切换 + 持久化 + 降级提示
```

页面只做一件事：读 `useAppearance()` 拿到 id，再从 `registry` 里取对应视图渲染。
**状态持有者始终在页面层，视图是纯表现** → 切换外观不卸载状态持有者，因此
表单输入、滚动位置、当前路由、进行中的 AI 流式内容、云端保存/发布状态全部原样保留。

> **P1-01 的关键点**：光有「状态持有者在页面层」还不够——
> 灵数输入框的原始文本与随机取数器（`useManualRandomizer`：60ms 滚动 + 10s 自动停止）
> 原本**挂在视图子树里**，而切换外观会替换视图组件类型 → React 卸载整棵子树 →
> 文本与滚动状态一起消失，父层却还记着「正在滚动」，启卦按钮被永久禁用。
> 现在这两样状态都上移到 `useNumberBoxesState`（稳定层，位于 `DivinationForm` 内，
> 不随外观变化而卸载），`NumberBox` / `NumberBoxWithRandomizer` 变成完全受控组件，
> 视图只负责画与回调。

### 3.2 外观作用方式

- 唯一作用点：`<html data-appearance="qinglan|zhusha|yehang">`。
- 颜色一律走语义令牌（`--color-bg-*` / `--color-text-*` / `--color-accent*` / `--color-border*` / `--color-on-accent` …），
  三套外观只在 `src/styles/appearance.css` 里重定义这些令牌。
- 旧调色板变量（`--color-rice` / `--color-ink` / `--color-june-*`）在每套外观里重新映射，
  所以**尚未逐页改造的旧页面**（图鉴 / 卦册 / 社区 / 卦象详情）也会跟着换肤，不需要额外工作。
- 没有用 `aria-label` 承载外观，也没有深层的 DOM 选择器换肤。

### 3.3 三套外观的差异是**结构**而不只是配色

| | A 青岚书院 | B 朱砂档案 | C 夜航观象 |
|---|---|---|---|
| 首页 | 左右分区：左「慢下来，读懂此刻的自己。」+ 右拱形青绿山水插画；下接「今日卦境」三栏与「探索易象阁」 | 印版 hero（朱砂顶边方框 + 圆形「易」印 + 竖排边栏 + 卷壹/六十四象索引条） | 深色星图 hero（自绘星图 SVG + 观测面板 + 仪表读数） |
| 起卦 | 左引导（把心事放下，让答案浮现。+ 拱形山水 + 01 静心/02 问事/03 取数）右表单 | 左右两栏书页 + 中间墨线 + 方形双标签 | 左叙述 + 右侧观测面板卡 |
| 结果 | 「万象流转，自有回响。」+ 本卦/变卦对读卡 + 动爻 + 解读 + TAKE IT WITH YOU 边栏 | 本卦变卦并排双栏 + 竖排边栏 + 朱砂印章 | 圆环卦象对卡 + 动爻面板 + 右侧 290px 侧栏 |

### 3.4 令牌映射（A 按 A 提案落地，不再保留旧生产调色板）

**这一节在上一版里写的是「A 刻意保留朱砂红主色」，独立验收报告判定那是一处**未经授权的偏离**
（brief 要求三套提案全部保留为正式外观，没有授权用旧版替换 A），本轮已经改掉。**

现在的做法：

- **A 的语义令牌就是 A 提案自己的色板**（`src/styles/tokens.css` 的 `:root` 即 A 外观）：

  | 提案变量 | 值 | 对应的语义令牌 |
  |---|---|---|
  | `--dg-bg` | `#f5f4ec` | `--color-bg-page` / `--color-rice` |
  | `--dg-paper` | `#fcfbf5` | `--color-bg-paper` |
  | `--dg-ink` | `#263e34` | `--color-text-primary` / `--color-ink` |
  | `--dg-muted` | `#5c6c61` | `--color-text-muted`（**实现里加深到 `#56675c`**，原值在纸上只有 4.32:1，达不到 4.5:1） |
  | `--dg-line` | `#d3dbcf` | `--color-border` |
  | `--dg-accent` | `#355e4b` | `--color-accent`（主色）/ `--color-june-red` |
  | `--dg-on-accent` | `#fffdf4` | `--color-on-accent` |
  | `--dg-tint` | `#e9ede2` | `--color-bg-soft` |

- **A 的三页视图整体重做**，对照 `/design-preview?direction=a&page=home|cast|result` 落地，
  不再是「提案之前的旧版首页/起卦/结果」，也不是「结构沿用旧版、只换配色」。
  新视图用独立命名空间 `ql-home-*` / `ql-cast-*` / `ql-result-*` + 三个新样式文件
  （`src/styles/appearance/qinglan-{home,cast,result}.css`），旧的 `.home-*` / `.divination-*` / `.result-*`
  规则原样保留（还有旧页面在用），不被新视图依赖。
- **并排核对证据**：`screenshots/proposal-compare/` 里是六张并排截图
  （`proposal-a-{home,cast,result}.png` vs `impl-a-{home,cast,result}.png`），
  用来人工核对「提案长什么样」与「实现长什么样」：
  - 首页：左右分区、「慢下来，读懂此刻的自己。」主标、拱形山水插画、
    「一事一问 / 一日一观 / 一念一新」、下方「DAILY READING / 今日卦境」与右侧「从一卦，走向更辽阔的自己。」都在。
  - 起卦：左侧「A MOMENT FOR YOURSELF / 把心事放下，让答案浮现。」+ 拱形山水 + 01 静心 / 02 问事 / 03 取数，
    右侧卡片「THREE NUMBERS, ONE INSIGHT / 三数起卦 / 01 此刻，你想问什么？/ 02 随心，定下三个数字」都在。
    **提案里那枚「随机取三个数」的演示按钮没有实现**——实现是三格各自一个「天降灵数」，
    走真实的取数逻辑（一次摇三个数不是站点的业务能力）。
  - 结果：「万象流转，自有回响。」+ 「此刻所问」问句条 + 本卦/变卦对读卡（含卦象 SVG + 卦名 + 卦辞 + 读卦辞原文）
    + 右侧 TAKE IT WITH YOU 侧栏都在；提案侧栏里的「我喜欢这个版式」是演示按钮，
    实现换成了**真实的收藏到卦册 / 发布到社区 / 下载卦象卡**。
- **B / C 维持各自的调色板**（朱砂档案 = 暖纸 + 朱砂；夜航观象 = 墨绿 + 淡金），
  仍然只在 `src/styles/appearance.css` 里覆盖同一批语义令牌。
- 旧调色板变量（`--color-rice` / `--color-ink` / `--color-june-*`）在三套外观里各自重映射，
  所以尚未逐页改造的旧页面（图鉴 / 卦册 / 社区 / 卦象详情 / 404）也跟着换肤。

---

## 4. 变更文件清单

### 4.1 新增（本次实现）

| 文件 | 说明 |
|---|---|
| `src/lib/appearance.ts` | 外观白名单、归一化、选项元数据（名称/副题/描述/色卡） |
| `src/contexts/AppearanceContext.tsx` | 外观上下文：读取、切换、持久化、storage 事件、存储不可用降级 |
| `src/components/layout/AppearanceSwitcher.tsx` | 顶栏外观下拉（`menu` / `menuitemradio` / 键盘导航） |
| `src/components/layout/AppearancePicker.tsx` | 设置页卡片选择器（`radiogroup` / `radio` / 漫游 tabindex） |
| `src/components/appearances/shared/types.ts` | 三个视图的 props 契约 |
| `src/components/appearances/shared/CastFormShell.tsx` | 跨外观的表单外壳（统一处理 reduced-motion） |
| `src/components/appearances/registry.ts` | 外观 id → 视图组件 |
| `src/components/appearances/qinglan/*` | A 的三页视图（**按 A 提案重做**，`ql-` 命名空间 + 独立样式表） |
| `src/components/appearances/zhusha/*` | B 的三页视图 + 共用零件 |
| `src/components/appearances/yehang/*` | C 的三页视图 + 星图 SVG |
| `src/components/ui/NumberBoxRandomizer/state.ts` | **稳定层**：`useNumberBoxesState`（原始文本 / 合法值 / 三个取数器状态），P1-01 的根因修复 |
| `src/lib/numberText.ts` | 灵数文本的纯函数：`sanitizeNumberText` / `parseNumberText` / `numberToText`（最多三位、100–999） |
| `src/styles/appearance.css` | 三套外观的语义令牌覆盖 + 焦点/选中态 + 主按钮 |
| `src/styles/appearance-ui.css` | 外观切换器 / 选择器的外观样式（含 320px 收敛） |
| `src/styles/appearance/zhusha.css` | B 的版式与配色（`zh-` 前缀） |
| `src/styles/appearance/yehang.css` | C 的版式与配色（`yh-` 前缀） |
| `src/styles/appearance/qinglan-home.css` | A 首页（A 提案版式：`ql-` 前缀） |
| `src/styles/appearance/qinglan-cast.css` | A 起卦页（A 提案版式） |
| `src/styles/appearance/qinglan-result.css` | A 结果页（A 提案版式） |
| `tests/lib/appearance.test.ts` | 白名单/归一化/默认值/存储往返/无效值回落/旧设置兼容/写失败 |
| `tests/lib/numberText.test.ts` | 灵数文本纯函数（10 例） |
| `tests/components/AppearanceSwitcher.test.tsx` | 顶栏↔设置联动、键盘、aria 语义、存储失败提示、刷新恢复 |
| `tests/components/AppearanceSwitchState.test.tsx` | 切换不丢表单/数字/AI 流式/发布状态、不重复请求 |
| `tests/components/AppearanceSwitchKeepsCastState.test.tsx` | **P1-01 回归**：未满三位 / 无效三位 / 滚动中 / 停止后再切换 × 六个切换方向（6 例） |
| `tests/helpers/numberBoxHarness.tsx` | 测试支架：把受控灵数输入接到真实稳定层上 |
| `scripts/acceptance-appearances.mjs` | 浏览器验收矩阵（3 外观 × 9 页 × 5 宽度 + 模拟 200% + reduce 模式 + 结果四态 = 174 组），**失败即非零退出** |
| `scripts/shared-appearances-probe.mjs` | 三个验收脚本共用的阈值、装饰豁免清单与探针 |
| `scripts/contrast-appearances.mjs` | 像素级对比度测量（真实合成底色 + 最弱落点判定） |
| `scripts/zoom-real-200.mjs` | **真实浏览器 200% 缩放验收**（独立 Chrome 实例 + 系统原生快捷键注入） |
| `scripts/appearance-smoke.mjs` | 三套外观的冒烟脚本 + 截图 |
| `scripts/appearance-journey.mjs` | 端到端行为走查（选 B → 填数 → 切 C → 启卦 → 切 A → 刷新 → 卦册），含请求计数与 P1-01 回归段 |
| `scripts/probe-overflow.mjs` | 诊断工具：找出指定宽度下横向越界的元素 |
| `scripts/shot-clip.mjs` | 诊断工具：截取指定元素的区域放大图 |
| `docs/reviews/2026-10-23-three-appearances-implementation.md` | 本文档 |

### 4.2 修改（本次实现）

| 文件 | 改动 |
|---|---|
| `index.html` | 预绘内联脚本：首帧前写入 `data-appearance` + 同步页面底色（消除 C 的冷启动闪白） |
| `src/main.tsx` | 引入 `appearance.css` / `appearance-ui.css` |
| `src/App.tsx` | 套上 `AppearanceProvider`（在 `MotionConfig reducedMotion="user"` 内） |
| `src/lib/appearance.ts` | 外观白名单、归一化、选项元数据、`APPEARANCE_PAGE_BG`（首帧底色） |
| `src/lib/storage.ts` | `UserSettings.appearance` 白名单化读写；新增 `getAppearance()` / `saveAppearance()` |
| `src/types/record.ts` | `UserSettings.appearance?: AppearanceId` |
| `src/contexts/AppearanceContext.tsx` | 外观上下文：读取、切换、持久化、storage 事件、存储不可用降级、同步根节点底色 |
| `src/components/layout/Header.tsx` | 顶栏加入外观下拉 |
| `src/pages/Settings.tsx` | 设置页加入外观卡片；`text-[11px]` → `text-[12px]` |
| `src/pages/Home.tsx` | 改为状态持有者 + 按外观取视图 |
| `src/components/sections/DivinationForm.tsx` | 改为状态持有者 + 按外观取视图 |
| `src/components/sections/ResultDisplay.tsx` | 改为状态持有者 + 按外观取视图 |
| `src/components/ui/Button.tsx` | 主按钮改用 `ui-button--primary` 钩子，颜色交给令牌层 |
| `src/components/ui/Seal.tsx` | 印色改用 `--color-accent` / `--color-on-accent` |
| `src/components/ui/PageTitle.tsx` | 页匾 SVG 的硬编码纸色/赭石/藤黄改成令牌（否则 C 外观下浅底浅字） |
| `src/styles/tokens.css` | A 的语义令牌换成 **A 提案自己的青绿色板**（`--color-accent:#355e4b`、`--color-ink:#263e34`、`--color-rice:#f5f4ec` 等），旧 `--color-june-*` 变量同步重映射；`--color-text-muted` 由 `#5c6c61` 加深到 `#56675c`（对比度不达标） |
| `src/styles/appearance.css` | B / C 仍在这里覆盖同一批语义令牌（朱砂暖纸 + 朱砂、夜航墨绿 + 淡金） |
| `src/styles/appearance/qinglan-{home,cast,result}.css` | A 的三页版式（`ql-` 前缀），不依赖旧的 `.home-*` / `.divination-*` / `.result-*` 规则 |
| `src/styles/appearance/zhusha.css` | `.zh-status small` 显式 `font-size: var(--text-caption)`（修 P2-01 的 9.6px）；面包屑与灵数 label 补 24px 最小点击高度 |
| `src/styles/appearance/yehang.css` | 面包屑「首页」、`.yh-field__title label` 与灵数 label 补 24px 最小点击高度 |
| `src/styles/appearance/qinglan-cast.css` | A 的灵数 label 补 24px 最小点击高度 |
| `src/styles/divination.css` | 旧起卦页的灵数 label 补 24px 最小点击高度 |
| `src/components/ui/NumberBox.tsx` | 改为**受控**（`text` + `onTextChange`），保留 `data-filled` / `aria-invalid` 语义 |
| `src/components/ui/NumberBoxRandomizer/index.tsx` | 改为**受控**（`field` + `onTextChange/onStart/onStop`），滚动态由上层给出 |
| `src/components/ui/QuestionInput.tsx` | label 补 24px 最小点击高度 |
| `src/pages/Records.tsx` | 「再起一卦 →」补 24px 最小点击高度 |
| `src/pages/NotFound.tsx` | 「返回首页」补 24px 最小点击高度 |
| `src/components/appearances/shared/types.ts` | `CastAppearanceProps`：视图只收**受控 props**，不再自己持有灵数状态 |
| `src/components/appearances/{qinglan,zhusha,yehang}/Cast*.tsx` | 三套起卦视图按新契约改写（不再各自持有输入与取数器） |
| `src/styles/home.css` | 「变卦 · XX」链接补 24px 最小点击高度 |
| `src/styles/studio.css` | ≤479px 收紧顶栏（修 320px 横向溢出） |
| `src/pages/Records.tsx` / `src/pages/Feed.tsx` | 10/11px 辅助文字提到 12px |
| `src/pages/HexagramDetail.tsx` | 「♡」改为跟随按钮文字色（原来红字压红底，1.22:1） |
| `src/components/hexagram/HexagramCard.tsx` | 关键词最小字号提到 12px |
| `tests/components/Button.test.tsx` | 跟随主按钮钩子变更 |
| `tests/components/DivinationForm.test.tsx` | 改用受控灵数输入；预置问句断言改为「来自站点问询池」而非逐字硬编码 |
| `tests/components/NumberBoxRandomizer.test.tsx` / `NumberBoxRandomizerReducedMotion.test.tsx` | 跟随受控 API 改写 |

### 4.3 **不属于本次交付**的既有未提交改动（保持原样，不要动）

`public/sitemap.xml`（构建会重写 lastmod）、`vite.config.ts`、`src/lib/apiConfig.ts`、
`tests/lib/apiConfig.test.ts`、`verify-local.ps1`、`.tmp-wrangler.err`，
以及上一轮「首页/起卦/结果页改版」交付的 `src/styles/{home,divination,result,studio}.css`、
`src/components/sections/DailyHero.tsx` 等一批文件。

---

## 5. 本地怎么跑

```powershell
npm install
npm run dev            # http://localhost:5173
```

- 站点：`http://localhost:5173/`（顶栏「外观」下拉，或 `/settings` 里的卡片）
- 设计预览（原稿）：`http://localhost:5173/design-preview?direction=a|b|c&page=home|cast|result`
- 验收脚本需要真实 Chrome + CDP：

```powershell
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
Start-Process $chrome -ArgumentList @('--headless=new','--disable-gpu','--remote-debugging-port=9222',"--user-data-dir=$env:TEMP\chrome-cdp-profile",'about:blank')
node scripts/acceptance-appearances.mjs    # 矩阵 + 截图 + JSON 报告（135 矩阵 + 27 模拟200% + 12 结果四态 = 174 组）
node scripts/contrast-appearances.mjs      # 像素级对比度（454 处）
node scripts/appearance-journey.mjs        # 端到端行为走查 + P1-01 回归段（35 项）
node scripts/zoom-real-200.mjs             # 真实浏览器 200% 缩放验收（自己起 Chrome，端口 9333）
```

> `zoom-real-200.mjs` 会**自己**起一个独立 Chrome（端口 9333，独立 profile），不需要上面的 9222 实例；
> 但它需要有界面（headful），因为真实浏览器缩放快捷键必须由操作系统送进浏览器进程——
> headless 下浏览器不处理注入的按键。脚本会短暂地在桌面上出现 Chrome 窗口。

产物：`screenshots/acceptance-appearances/`（含 `acceptance-appearances.json`）、
`screenshots/contrast/contrast-appearances.json`、`screenshots/journey/`、
`screenshots/zoom-real-200/`（含 `zoom-real-200.json`）、
`screenshots/appearance/`（冒烟截图）。

---

## 6. 门禁结果

| 门禁 | 命令 | 结果 |
|---|---|---|
| 前端单测 | `npm test` | 52 个文件 / **455 个用例**全部通过 |
| 类型检查 | `npm run typecheck` | 0 error |
| 前端构建 | `npm run build` | 通过 |
| Worker 类型检查 | `cd worker && npm run build` | 通过（本次未改 worker 路由，未跑 worker 测试） |

浏览器验收（第二轮复验后最后一次运行，**0 失败项**）：

| 脚本 | 覆盖 | 结果 |
|---|---|---|
| `acceptance-appearances.mjs` | 3 外观 × 9 页 × 5 宽度 = **135** + 模拟 200% **27** + 结果四态 **12** = **174 组** | 失败 **0** / 豁免 **9** / 覆盖 **174/174** |
| `contrast-appearances.mjs` | 454 处关键文字像素级实测（前置**算法自检**） | 通过 **454** / 失败 **0** / 豁免 **4**（装饰）/ 未覆盖 **0**，最低 **4.83:1**（青岚起卦页「启 卦」按钮）** |
| `appearance-journey.mjs` | 端到端行为序列 + P1-01 回归段 | **35 项断言**全部通过 |
| `zoom-real-200.mjs` | 真实浏览器 200% 缩放 × 3 外观 × 3 页 × 6 档 CSS 视口 = **54 组** | 失败 **0** / 豁免 **0** / 覆盖 **54/54**（**45 组达到标称档位 + 9 组平台限制档**），**真实缩放已验证** |

矩阵里的 9 条豁免全部是同一件事：**195px CSS 视口**（模拟 200% 下 390px 物理窗口的一档）
低于本项目 320px 的设计下限，该档不判失败，但**逐条打印了实测值与豁免理由**，不再静默省略。

> 真实缩放那一档的宽度口径见 §7.1.3：脚本会核对标称与实测 CSS 视口，
> 浏览器最小窗口宽度导致没达到标称档位的组**单列为平台限制档**（9 组，实测 243px），
> 不按 195px 记账，也不算产品失败。

> `npm run lint` 在本机不可用（脚本/依赖缺失），故未列入。
> `npm run build` 的 prebuild 会重写 `public/sitemap.xml` 的 lastmod；已把构建前后的差异还原，
> 避免把时间戳噪音折进本次交付。
> `npm test` 在浏览器验收脚本**并发**跑时曾偶发一次失败（`NumberBoxRandomizerReducedMotion`
> 报「找到多个同名元素」+ 5s 超时），单独跑与全量串行跑均通过，判断为并发负载下的时序抖动，非功能缺陷。
> 串行跑（本轮实际执行方式）：**455/455 通过**。

---

## 7. 验收矩阵与证据

### 7.1 浏览器矩阵（`scripts/acceptance-appearances.mjs`）

- 三套外观 × {首页, 起卦, 结果, 图鉴, 卦册, 设置, 卦象详情, **社区 /feed**, **404**} × {1440, 1024, 768, 390, 320}
  = 9 页 × 3 外观 × 5 宽度 = **135 组**
- 结果页四态：未解读 / 加载中 / 错误重试 / 缓存 = **12 组**
- **模拟** 200% 缩放（**明确命名为「模拟」**）：把 CSS 视口减半（1440→720、768→384、390→195）
  并把渲染倍率设为 2 —— 这是 DevTools「缩放 200%」的同款实现。
  **它是模拟，不是真实浏览器缩放**；真实缩放单独做，见 §7.1.2。
- `prefers-reduced-motion`：开启时随机取数滚轮**不透明度恒定**（无逐帧淡入），
  关闭时同一滚轮不透明度持续变化 —— 一次跑两个模式，互为对照，避免「检测手段本身失效」被当成通过
- 每一次导航都用**轮询断言**页面真的渲染出来（`readyState` + 标题 + `#root` 有子节点 + 关键节点存在 +
  元素数 > 30 + 页面文本不含连接失败），不用固定 sleep 判成功；断言不通过就记失败并跳过该项测量，
  不会把「连不上」输出成「没溢出」
- **判定口径**：横向溢出、字号 <12px、目标 <24px、对比度不足**全部计入失败**，
  脚本以非零码退出；只有「装饰元素」与「CSS 视口 <320px 的设计下限档」可以豁免，
  且豁免必须逐条打印实测值与理由

### 7.1.2 真实浏览器 200% 缩放（`scripts/zoom-real-200.mjs`，单独做）

真实缩放**不能**用 `Emulation.setDeviceMetricsOverride` 模拟——那只是把 CSS 视口减半、
把渲染倍率设成 2，桌面浏览器并没有真的进入 200% 缩放状态。所以这一项单独用一个脚本做。

**方法（已验证）**：起一个**有界面**的独立 Chrome（端口 9333，独立 profile），
用 Win32 `keybd_event` 把 `Ctrl+'+'` / `Ctrl+0` **真的敲进浏览器窗口**——
走的是「操作系统 → 浏览器进程 → 浏览器缩放级别」这条完整链路，和用户手按快捷键完全一样。

**自证判据**（三条同时成立才算真实缩放）：

| 指标 | 100% | 200% | 判定 |
|---|---|---|---|
| `devicePixelRatio` | 1.25 | **2.5** | ×2.000 ✅ |
| `window.innerWidth`（CSS 视口） | 1426px | **713px** | 收窄到 50.0% ✅ |
| `window.outerWidth`（物理窗口） | 1440px | **1440px** | 窗口没变，证明是页面缩放而不是把窗口改小 ✅ |
| `visualViewport.scale` | 1 | 1 | 不是捏合缩放 |

> 关键点：headless 下浏览器**不处理**注入的快捷键（CDP `Input.dispatchKeyEvent` 也一样无效），
> 所以脚本要开有界面实例 + 系统级输入注入。脚本保留了三级降级
> （系统注入 → CDP 注入 → 每站点缩放级别 → 设备像素比模拟），
> **每一级都会把成败如实写进报告**；最后那级（只改 dpr、视口不变）在报告里明确标注
> 「非真实缩放」并直接判失败。

**覆盖**：3 外观 × 3 页（首页/起卦/结果）× 6 档 CSS 视口
（1440 / 768 / 390，以及物理窗口 1440 / 768 / 390 在 200% 下的 720 / 384 / 195）= **54 组**。

**结果**：**失败 0 / 豁免 0 / 覆盖 54/54**，真实缩放**已验证**（实测 200%）。
产物：`screenshots/zoom-real-200/`（54 张截图 + `zoom-real-200.json`，
报告里记录了缩放值、缩放前后 CSS 视口、方法与逐次按键过程）。

#### 7.1.3 宽度覆盖口径：标称档位 vs 实测宽度（第二轮复验 P3 的处理）

**设置外窗宽度 ≠ 实际拿到目标 CSS 视口**——浏览器有最小窗口宽度限制，
滚动条和窗口边框也会带来十几像素的固定差。上一版脚本只把
`requestedCssWidth` / `actualCssWidth` 记进报告却**不做校验**，
于是「标称 195px、实测 243px」的 9 组仍被算作 195px 档的完整覆盖。

现在的口径：

| 字段 | 含义 |
|---|---|
| `requestedCssWidth` | 该档**标称**的 CSS 视口宽度 |
| `actualCssWidth` | 实测的 CSS 视口宽度（`document.documentElement.clientWidth`） |
| `widthDeviation` | `actual − requested` |
| `widthMatched` | `\|deviation\| ≤ WIDTH_TOLERANCE`（20px，滚动条/边框的正常差约 15px） |
| `effectiveTier` | 达到标称档位就是档位名；没达到则记成 `<档位名>@<实测>px` |
| `coverage.platformLimited` | 没量到标称档位的组数（单列，不算产品失败） |
| `report.platformLimits[]` | 这些组的标称值、实测值、偏差与原因 |

实测结果（6 档 × 9 组合）：

| 档位 | 标称 CSS 视口 | 实测 CSS 视口 | 偏差 | 记账 |
|---|---|---|---|---|
| css-1440 | 1440 | 1425 | −15 | 达到标称档位 |
| css-768 | 768 | 753 | −15 | 达到标称档位 |
| css-390 | 390 | 375 | −15 | 达到标称档位 |
| half-1440-window | 720 | 705 | −15 | 达到标称档位 |
| half-768-window | 384 | 369 | −15 | 达到标称档位 |
| half-390-window | 195 | **243** | **+48** | **平台限制档**（浏览器最小窗口宽度，按实测 243px 记账） |

脚本终态输出：

```
覆盖 54/54 组；失败 0 项 / 豁免 0 项
其中达到标称档位 45 组，平台限制档 9 组（见下）
平台限制档（没量到标称 CSS 视口，按实测值记账）：
  - half-390-window：标称 195px → 实测 243px（实际 CSS 视口比标称宽 48px：
    浏览器最小窗口宽度限制，标称 195px 未达到（实测 243px））
```

> 复验方明确**不要求**项目支持 195px、也不要求把低于 320px 的布局溢出改成产品失败。
> 因此这一档按「平台限制」记账并写明原因，不静默省略，也不虚报成 195px 已覆盖。

### 7.2 对比度（`scripts/contrast-appearances.mjs`，像素级）

方法：对目标文字截两张图（正常 / 把该元素文字设为 `transparent`），差集得到「字的像素」；
然后算**文字真实颜色**（元素自身及其后代的 `color`，按 alpha 合成到不透明底色）
与**该文字每一处落点上的实际背景色**（渐变 / 插画 / 半透明遮罩都算进去）之间的 WCAG 对比度，
取**所有落点里的最小值**。

> 这一版修掉了上一版脚本的两个真错误：
> 1. 旧指标取「差值 ≥ 最大差值 90% 的像素的中位色」当字色，再用同一像素处的底色算对比度。
>    那测的是**抗锯齿边缘**，不是文字对比度（例如 A 卦册那处旧算法报 4.32:1，真实值是 6.03:1）。
>    现在主指标是「文字真实 CSS 颜色 × 落点实际底色」的最小值（**最弱落点**），
>    逐像素的抗锯齿值只作为参考量输出，不再当结论。
> 2. 旧脚本在**动画过渡中**读 `getComputedStyle().color`，拿到的是插值中的
>    `rgba(211,214,198,0.427)`，导致夜航的 `.yh-btn--text` 误报 3.12:1（真实值 10.78:1）。
>    现在先 `freezeScene()`（结束入场动画、暂停循环动画）**再**取色。
>    另外裁剪框边缘 1px 会把描边重新光栅化，已从差集统计里排除。

**覆盖与结果**：**454 处关键文字，通过 454 / 失败 0 / 豁免 4 / 未覆盖 0**，最低 **4.83:1**（青岚起卦页「启 卦」按钮）**。
4 条豁免全部是 `aria-hidden` 的纯装饰（A 的山水图注与题刻 ×2、朱砂的双卦水印 ×1、结果页卦名水印 ×1），
每条都写明理由。

**「未覆盖」会算失败**：找不到目标元素时不再静默跳过，而是计入失败项。

#### 7.2.1 对比度算法：位置识别与对比度数值解耦（第二轮复验 P2 的处理）

上一版虽然把字色换成了「CSS 颜色 × 实际底色」，但**取样位置**仍然是
「两图全局最大差值的 90%」：

```js
const cut = maxDiff * 0.9
if (maxDiff > 0 && diffs[p] >= cut) { /* 只有入选位置参与 weakestRatio */ }
```

这等于**只保留前景/背景差异最大的区域**——恰好把要找的低对比度落点排除掉。
复验方给的反例可以直接打出这个洞：500×70 画布，左半白底、右半 `#333333` 底，
两侧都是纯黑 24px 粗体字。黑字压在 `#333` 上的真实对比度是 **1.6621:1**，
旧函数却返回 `weakestRatio = 21` 并判通过——最弱落点被它挑到了左边的白底上。

现在改成**两段式**，核心是**覆盖率 α**：

```
// 每个文本片段（Range.getClientRects() 逐文本节点取矩形）
d      = |P − B|                 // P=有字截图，B=去字截图（逐像素最大通道差）
eff    = 该片段字色（含 alpha × 元素及祖先 opacity）合成到底色上
expect = |eff − bg|
α      = d / expect              // 这个像素被文字盖住了多少
```

- **位置识别**：`α ≥ 0.5` 的像素才算「文字像素」。
  门槛由**字色自己**决定，与背景对比度无关——所以低对比度区域不会再被筛掉。
- **对比度数值**：文字颜色按**该片段自己的计算色**（逐文本节点取父元素的 `color`，
  `<span>` 强调色不会被父级字色覆盖），底色取该落点的实际底色，
  判定值 = `contrast(eff, bg)`，取所有落点最小值。
- **抗锯齿**：`minPixelRatio` 仍输出，但**只作参考量**，不作门禁。

**算法回归（`runAlgorithmSelfTest()`）**——在正式测量**之前**执行，失败直接 `process.exit(1)`：

- 反例（黑字压 `#333` 底）必须 **低于阈值**且**进入失败列表**；
- 单色合格样例（黑字压白底）必须**保持通过**。

```
=== 算法自检 ===
  反例（黑字压 #333 底）: weakestRatio=1.66 最弱落点={"x":262,"y":27}
  合格样例（黑字压白底）: weakestRatio=21
  自检通过
```

反例的 1.66 与手算的 1.6621:1 一致，最弱落点也落在**右半边**（x=262 > 250）。

顺带修掉的两处忠实度问题（都是这一轮实测中暴露的）：

| 问题 | 现象 | 处理 |
|---|---|---|
| 元素 `opacity` 没参与字色合成 | 朱砂水印 `opacity: 0.16`，旧算法按声明色算成 5.58:1，真实渲染只有 **1.26:1** | 逐级累乘元素与祖先的 opacity，字色按真实合成结果计算；豁免理由不变（装饰、不承载信息），但数值不再好看化 |
| 在入场动画中途测量 | framer-motion 淡入期间元素 opacity 实测 0.44→0.97→1，量到的「字色」是半透明中间态，会把真实的 14:1 报成 **1.25:1** | 测量前轮询到**没有有限动画在跑**为止（不用固定 sleep）；仍未稳定的标 `settled:false` 留痕。循环动画由 `freezeScene()` 暂停，不参与判断 |

另外，测前会等 `document.fonts.ready`——否则「有字」「无字」两张截图可能用的是不同字体，
差集里出现的是字形变化而不是文字覆盖，算出来的覆盖率是假的。


### 7.3 端到端行为走查（`scripts/appearance-journey.mjs`）

需求书 §7 的行为序列在**真实浏览器**里跑了一遍，**35 项断言**全部通过（含本轮新增的 P1-01 回归段）：

```
默认 A → 顶栏下拉选 B → 起卦页填「所问之事」+ 123/456/789 → 切到 C（输入仍在）
→ 切回 A（输入仍在）→ 启卦 → 结果页（真实记录 ID / 本卦明夷 / 变卦地雷复 / 第 3 爻动）
→ 结果页切 B 再切 C（URL 与记录内容不变）→ 刷新（仍是夜航观象 + 同一条记录）
→ 卦册（本地只有 1 条，就是刚才那条）
```

同时用 CDP `Network` 事件统计请求数，证明：

- 每次切换外观期间 **新增 API 调用 = 0**（不创建记录、不调 AI、不自动保存、不发布）；
- 启卦本身也 **新增 API 调用 = 0**；
- 结果页切外观前后 **新增 API 调用 = 0**（不重复发请求）。

**P1-01 回归段**（本轮新增）：

```
未满三位的输入（"12"）跨外观切换后仍在，启卦仍禁用
无效三位（"099"）跨外观切换后原样保留，启卦仍禁用
第一格取数器进入滚动态 → 切换外观 → 仍在滚动，新外观里出现「停止」按钮
→ 点停止 → 灵数落定为一个三位数（实测 397）
```

产物：`screenshots/journey/`（过程截图 + `appearance-journey.json`）。

### 7.4 单元 / 组件级

| 用例 | 覆盖点 |
|---|---|
| `tests/lib/appearance.test.ts` | 白名单、归一化、默认 A、存储往返、无效值回落 A、旧设置兼容、其它设置不被覆盖、写失败返回 false、损坏 JSON 回落 |
| `tests/lib/numberText.test.ts` | 灵数文本纯函数：最多三位、100–999 边界、空串/非数字/超长（10 例） |
| `tests/lib/hexagramLines.test.ts` | 爻序自下而上；全阳/全阴；**阴阳混合卦（地天泰）**同样自下而上 |
| `tests/components/YaoLineStack.test.tsx` | 六爻渲染数量、动爻高亮位、**混合阴阳时 DOM 顺序 = 上爻在上**（用真实卦数据） |
| `tests/components/AppearanceSwitcher.test.tsx` | 默认 A 且根节点属性正确、顶栏↔设置联动、下拉选择并持久化、`aria-checked` 语义、键盘（方向键/Esc/焦点归还）、卡片方向键、存储失败提示、刷新恢复、旧值/非法值回落、切换不卸载页面内容、根节点底色随外观走 |
| `tests/components/AppearanceSwitchState.test.tsx` | 问题与三数跨切换保留、禁用态保留且不生成记录、结果页保留本卦/变卦/AI 文本且**只发一次** AI 请求、流式进行中切换不重发、发布状态保留且只调用一次 |
| `tests/components/AppearanceSwitchKeepsCastState.test.tsx` | **P1-01 回归（6 例）**：未满两位数跨三个方向保留；无效三位 `099` 保留且启卦禁用；**滚动中**切换后仍在滚动、新外观「停止」可用、落定、进度文案正确；停止后再切换数字不变；切回来仍在滚动且 10s 超时自动停止；切换不新建记录 |

---

## 8. 本轮发现并修掉的问题

### 8.1 独立验收报告指出的 4 项（返工轮修掉）

| 编号 | 问题 | 根因 | 处理 |
|---|---|---|---|
| **P1-01** | 切换外观会**卸载灵数输入框与随机取数器** → 输入丢失、启卦被永久卡死 | 切换外观替换的是**视图组件类型**（`CAST_VIEWS[appearance]`），React 卸载整棵子树；原始文本在 `NumberBox` 内部、滚动计时器在 `useManualRandomizer` 内部，都跟着被卸载，而父层还记着「正在滚动」 | 原始文本 + 三个取数控制器整体上移到稳定层 `useNumberBoxesState`；`NumberBox` / `NumberBoxWithRandomizer` 改为完全受控；视图只收 props |
| **P1-02** | 青岚书院用的是**提案之前**的旧页面，不是 A 提案 | 上一版把「保留现有生产调色板」当成了授权，实际上 brief 没有这条 | A 的三页视图按 `/design-preview?direction=a&page=…` 整体重做（`ql-` 命名空间 + 三个新样式表），A 的语义令牌换成提案自己的青绿色板；旧的「A 刻意保留朱砂红」说法已从本文删除 |
| **P2-01** | 朱砂档案「已选定 x / 3 个灵数」是 9.6px | 靠 `<small>` 的 80% 继承算出来的 | `.zh-status small` 显式写 `font-size: var(--text-caption)`（12px） |
| **P2-02** | 验收脚本不足以支撑「0 失败，全部完成」 | 溢出只记日志不算失败；200% 用的是模拟；195px 档被静默省略；页面矩阵缺 /feed 与 404；对比度指标测的是抗锯齿 | ① 溢出/字号/目标/对比度全部计入失败，非零退出；② 200% 拆成「模拟矩阵」+ 独立的**真实缩放**脚本；③ 195px 档改为显式豁免并逐条打印；④ 补 /feed 与 404、加载错误态进矩阵；⑤ 对比度改用「最弱落点」判定，缺项算失败 |

### 8.2 返工轮里自己发现并修掉的问题

| 问题 | 根因 | 处理 |
|---|---|---|
| 对比度脚本把**抗锯齿边缘**当成字色 | 取「差值 ≥ 最大差值 90% 的像素中位色」测的是字的边缘过渡，不是文字颜色 | 主指标改为「文字真实 CSS 颜色 × 落点实际底色」的最小值；逐像素值降级为参考量 |
| 夜航 `.yh-btn--text` 误报 3.12:1（真实 10.78:1） | 在**动画过渡中**读 `getComputedStyle().color`，拿到插值色 | 先 `freezeScene()` 再取色 |
| 页匾 h1 误报 1:1 | 裁剪框边缘 1px 会把描边重新光栅化，差异像素被算成字 | 差集与字芯统计排除 1px 边框环 |
| 对比度脚本大面积「未覆盖」 | A 的类名换成了 `ql-*`，脚本还在找旧类名 | 更新选择器；未覆盖数从 15 降到 **0**，并改成「找不到即失败」 |
| 验收矩阵 31 项夜航失败 | **Vite 提供了过期的 `yehang.css`**（编辑后 mtime 没变） | 改完文件统一 touch `src/**` 的 mtime，重跑后失败数归零 |
| A 的「已选定 x / 3」对比度 4.32:1 | `--color-text-muted` `#5c6c61` 在纸上略低 | 加深到 `#56675c` |
| 灵数 label、「所问之事」label、「再起一卦 →」、「返回首页」、面包屑「首页」点击区 <24px | 纯文本 label 没有最小高度 | 统一补 `min-height:24px` + `inline-flex`（朱砂/夜航/青岚/旧起卦页四套样式） |
| 预置问句断言硬编码字符串 | A 的预置问句改用站点自己的问询池 `QUESTION_POOL` | 断言改为「来自问询池」+ 与保存记录一致，不再逐字硬编码 |
| 验收脚本偶发把「页面没渲染」判成失败 | 导航切换文档的瞬间 `document.body` 还是 `null`，`document.body.innerText` 抛 TypeError，被外层当成「页面未渲染」记成 `page-not-covered` 失败 | 三个脚本的页面探针改成 `(document.body && document.body.innerText) || ''`；轮询函数遇到瞬时求值异常继续轮询，只有连续到超时才判「没渲染」 |

### 8.3 第二轮复验（P2 / P3）里发现并修掉的问题

| 问题 | 根因 | 处理 |
|---|---|---|
| 对比度脚本**只在「变化最强的区域」取样**，漏掉最弱落点 | 位置门槛 `cut = maxDiff * 0.9` 是**全局**阈值，等于只保留前景/背景差异最大的区域，恰好把低对比度落点筛掉；复验方反例（黑字压 `#333`）真实 1.6621:1，脚本却报 21 并判通过 | 位置识别改为**覆盖率 α 掩膜**（`α = \|P−B\| / \|eff−bg\|`），门槛由字色自己决定，与背景对比度无关；对比度数值取所有落点最小值。详见 §7.2.1 |
| 多色后代可能被父级字色判错 | 整块元素只取一个 `color` | 片段逐文本节点取，`color` 取**该文本节点父元素**的计算色；`<span>` 强调色不被覆盖 |
| 元素 `opacity` 没参与字色合成 | 朱砂水印 `opacity: 0.16`，按声明色算成 5.58:1，真实只有 1.26:1 | 逐级累乘元素与祖先的 opacity，字色按真实合成结果算；豁免理由不变，数值不再好看化 |
| 在入场动画中途测量 | framer-motion 淡入期间 opacity 实测 0.44→0.97→1，半透明中间态被当成字色，把真实 14:1 报成 1.25:1 | 测量前轮询到**没有有限动画在跑**为止（不用固定 sleep）；仍未稳定的标 `settled:false` 留痕 |
| 真实缩放最小档标称 195px、实测 243px 仍按 195px 记账 | 脚本只记录 `requestedCssWidth` / `actualCssWidth`，**不做校验** | 逐组核对偏差（>20px 即没量到标称档位），单列为 `platformLimited` 写进 `report.platformLimits`，更正档位说明。详见 §7.1.3 |
| 对比度脚本缺算法回归 | 只有「跑一遍看结果」，没有对**已知反例**的断言 | 新增 `runAlgorithmSelfTest()`：反例必须判失败并进失败列表、合格样例必须保持通过，在正式测量前执行、失败即 `process.exit(1)` |

### 8.4 第一轮修掉的问题（保留备查）

| 问题 | 根因 | 处理 |
|---|---|---|
| B 主页主按钮「翻开我的这一页」2.06:1 | `.zh-page a { color: ... }`（0,2,0）盖掉了 `.zh-primary`（0,1,0），墨色字压在朱砂底上 | 提高选择器特异性到 `.zh-page a.zh-primary` |
| C 主页主按钮「开启一次观象」3.2:1 | 同类问题：`.yh-page a { color: inherit }` 盖掉了 `.yh-btn` 的 `--color-on-accent` | 提高到 `.yh-page a.yh-btn`（含 outline / text 两个变体） |
| 320px 下顶栏横向溢出 17px | 品牌 + 外观入口 + 设置链接在 320px 放不下 | ≤479px 时外观入口只留图标、顶栏收紧（gap 10px、隐藏拉丁文副题） |
| 卦象详情页「♡」1.22:1 | 主按钮底色本身是朱砂，里面又写了 `text-june-red` | 改为跟随按钮文字色 |
| 设置页「使用默认」3.97:1 | `--color-june-bronze #8B6914` 在 `--color-rice-dark` 上不足 4.5:1 | 加深到 `#7C5E12`（4.8:1） |
| 卦册/社区里 10~11px 辅助文字 | 旧页面写死 `text-[10px]` / `text-[11px]` | 统一提到 12px（社区小卡片不再重复显示关键词） |
| B 结果页卦名水印几乎不可见 | `opacity: 0.08` | 提到 0.16（仍是 `aria-hidden` 纯装饰，WCAG 豁免） |
| 朱砂档案禁用态按钮 4.26:1 | muted 文字配 disabled 底色差一点 | `--color-text-muted` 加深到 `#65564a` → 4.73:1 |
| 旧页面页匾「设 置」在 C 外观下几乎看不见 | `PageTitle` 的匾额 SVG 写死了浅米色底 + 深墨字，C 外观下字变成浅色 → 浅底浅字 | 匾额 SVG 改用 `--color-bg-paper` / `--color-june-bronze` / `--color-june-gold` / `--color-ink` 令牌 |
| 冷启动可能闪一下别的底色 | 开发模式 CSS 由 JS 注入，首帧可能早于样式表 | 预绘脚本同时给 `<html>` 写内联底色（`APPEARANCE_PAGE_BG`），运行时切换时同步更新 |

---

## 9. 遗留问题 / 未做

1. **云端接口在本地跑不通**：Worker 没启动时，「我的卦册」「社区卦册」会显示「云端卦册加载失败：HTTP 500」，
   页面本身优雅降级（本地卦册照常可用）✓。这是**本地环境边界**，不是缺陷，但截图里会出现这行提示。
2. **AI 解读走 mock/本地代理**：`functions/api/proxy/anthropic/*` 需要 Pages Functions（:8788）+
   `.dev.vars` 里的 `AI_DEMO_KEY`。本次验证的是**流式过程中的状态保持**，不是真实模型返回。
3. **输入框填充与页面底色 ≥3:1 在 C 调色板内做不到**：夜航所有背景令牌亮度都挤在 L 0.012–0.051，
   要把输入框填充拉出 3:1，填充得亮到正文只剩 2.7:1。按 WCAG 1.4.11 原文把 3:1 落在**控件边界**
   （`--color-control-border` 对底色 4.14~4.20:1），正文仍保持 ≥4.5:1。
4. **旧页面只换肤不改版**：图鉴 / 卦册 / 社区 / 卦象详情仍是原来的版式，只是跟着换令牌；
   它们的「逐页改造」不在本次 brief 范围内。
5. **A 的旧页面（首页/起卦/结果之外）仍是旧版式**：本轮按 P1-02 只重做了 A 的**三页**；
   A 外观下的旧页面（卦册/社区等）仍沿用第一轮的换肤方案。
6. **死代码**：`src/components/hexagram/TwinSpread.tsx`、`src/components/hexagram/FlipEntry.tsx` 仍无人引用，未清理。
7. **`npm run lint` 本机不可用**。
8. **真实缩放需要桌面会话**：真实 200% 缩放靠系统级键盘注入触发，
   因此 `zoom-real-200.mjs` 只能在**有界面的 Windows 桌面**上跑（headless 不行），
   且运行时会在桌面上短暂出现 Chrome 窗口。CI / 无头环境只能跑模拟矩阵。
9. **195px 档量不到（平台限制，不是产品缺陷）**：Windows 上浏览器有最小窗口宽度
   （约 500 物理 px），请求物理窗口 390px @200% 时实际 CSS 视口只能到 **243px**。
   脚本已核对标称/实测宽度并把这一档记为**平台限制档**（9 组），按实测 243px 记账。
   项目**不承诺**支持 195px；模拟矩阵里同档的横向溢出也仍是「低于 320px 设计下限、不判失败」的豁免。

---

## 10. Mock 与真实边界

| 能力 | 本次验证到什么程度 |
|---|---|
| 外观切换 / 持久化 / 降级 | **真实**（真浏览器、真 localStorage、真刷新） |
| 三套外观的版式与配色 | **真实**（真浏览器截图 + 像素级对比度） |
| 切换时灵数输入与取数器不丢 | **真实**（真浏览器走查 + 组件回归用例） |
| 浏览器 200% 缩放 | **真实**（系统级快捷键注入 → 浏览器自身的缩放级别；dpr ×2、CSS 视口减半、物理窗口不变） |
| 卦象计算（三数 → 本卦/变卦/动爻、阴阳爻序） | **真实**（`src/lib/divination.ts` 纯函数 + 单测） |
| AI 解读 | **mock**：只验证「请求中切换外观不丢流式内容、不重复发请求、错误可重试」，未验证真实模型输出 |
| 云端卦册 / 收藏 / 发布 | **mock**：Worker 未启动，接口返回 500，只验证了前端的错误处理与降级路径 |
| 社区卦册 | **mock**：同上 |
| 短信注册 / 配额 | 未涉及 |

---

## 11. 交付形态

- 全部改动**留在工作区，未 commit / 未 push / 未部署**。
- `git status` 可见 44 个已跟踪文件被修改、约 25 组新文件（含三个外观目录、稳定层与四个验收脚本）。
- 本轮新增/改动的核心文件：
  `src/components/ui/NumberBoxRandomizer/state.ts`（稳定层）、
  `src/lib/numberText.ts`、`src/components/appearances/qinglan/*` 与 `src/styles/appearance/qinglan-*.css`（A 提案重做）、
  `scripts/zoom-real-200.mjs`（真实缩放 + 宽度覆盖口径核对）、`scripts/acceptance-appearances.mjs` 与
  `scripts/contrast-appearances.mjs`（判定口径与指标重做）。
- 下一位接手者建议顺序：先跑 `npm test` + `npm run typecheck`，再依次跑
  `node scripts/appearance-journey.mjs`、`node scripts/acceptance-appearances.mjs`、
  `node scripts/contrast-appearances.mjs`、`node scripts/zoom-real-200.mjs`（最后一个需要有界面桌面），
  复现本文件的验收结论，最后才考虑提交。
  > `contrast-appearances.mjs` 开头会先跑**算法自检**（反例必须判失败），
  > 自检不过会直接非零退出——这说明算法本身退化了，不是页面变差了。
