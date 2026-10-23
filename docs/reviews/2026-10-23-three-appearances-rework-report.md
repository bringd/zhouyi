# 三套外观独立验收返工报告

日期：2026-10-23

- 验收依据（被复验材料）：`docs/reviews/2026-10-23-three-appearances-acceptance.md`（第一轮结论「本轮不通过」，4 项缺陷）
- 需求来源：`docs/plans/2026-10-23-three-appearances-implementation-brief.md`
- 交付记录：`docs/reviews/2026-10-23-three-appearances-implementation.md`（本轮已同步更新）
- 本报告性质：**返工方的自证报告**，不作为验收通过的依据；请复验方按 §6 的路径独立复测。

## 结论

**验收报告的 4 项缺陷全部处理完毕，自动化门禁与浏览器验收全部为 0 失败。**

本轮改动全部留在工作区，**未 commit、未 push、未部署**；`git log` 顶端仍是 `16ce92d`，
他人未提交改动（`public/sitemap.xml`、`vite.config.ts`、`src/lib/apiConfig.ts`、
`tests/lib/apiConfig.test.ts`、`verify-local.ps1`、`.tmp-wrangler.err`）原样保留。

| 验收报告条目 | 原判定 | 本轮状态 |
|---|---|---|
| P1-01 换外观丢输入、取数器被卸载、启卦卡死 | P1 | **已修**，根因修在状态所有权，不是靠刷新/清空绕过 |
| P1-02 青岚书院不是 A 提案 | P1 | **已修**，A 三页按提案重做，配色换成提案自己的青绿版 |
| P2-01 朱砂「已选定 x / 3」9.6px | P2 | **已修**，显式 12px |
| P2-02 验收脚本不足以支撑「0 失败」 | P2 | **已修**，判定口径、覆盖范围、200% 取证、对比度指标全部重做 |

> **本报告已按第二轮复验续写**：复验方结论见
> `docs/reviews/2026-10-23-three-appearances-reacceptance.md`
> （「功能和 A 方案视觉返工通过；完整验收暂不关闭」，留 1 项 P2 + 1 项 P3）。
> 续写内容见 **§0**，原有 §1–§9 是第一轮返工的原始记录，内容未改。

---

## 0. 第二轮复验遗留的两项缺陷（2026-10-23 续写）

复验方指出的两项都在**验收工具与交付证据层**，没有新的产品功能阻断。
本轮按复验要求改了算法、改了覆盖口径、重新取证。

| 复验条目 | 复验判定 | 本轮状态 |
|---|---|---|
| [P2] 对比度仍在「变化最强的区域」取样，会漏掉最弱落点 | P2 | **已修**：文字位置识别与背景对比度彻底解耦；反例进入算法回归；重跑正式目标 |
| [P3] 真实缩放最小档标称 195px，实测只有 243px 仍按 195px 记账 | P3 | **已修**：脚本核对标称/实测宽度，偏差超限单列为「平台限制档」；档位说明更正 |

### 0.1 [P2] 对比度：把「文字在哪」和「背景对比多少」拆开

#### 复验指出的偏差

旧实现用「两图全局最大差值的 90%」当作取样门槛：

```js
const cut = maxDiff * 0.9
if (maxDiff > 0 && diffs[p] >= cut) { /* 只有入选位置参与 weakestRatio */ }
```

这等于**只保留前景/背景差异最大的区域**——恰好把要找的低对比度落点排除掉。
复验方给的反例：500×70 画布，左半白底、右半 `#333333` 底，两侧都是纯黑 24px 粗体字。
黑字压在 `#333` 上的真实对比度是 **1.6621:1**（远低于 4.5:1），旧函数却返回 `weakestRatio = 21`
并判通过——最弱落点落在左边的白底上。

#### 本轮的算法

改成**两段式**：

1. **识别「哪里是文字」**——不再看差值大小，改看**覆盖率**。
   对每个文本片段（`Range.getClientRects()` 逐个文本节点取矩形），
   在该片段内逐像素算：

   ```
   d      = |P − B|          // P=有字截图，B=去字截图
   eff    = 该字色(含 alpha×opacity) 合成到底色上
   expect = |eff − bg|
   α      = d / expect
   ```

   `α ≥ 0.5` 才算「这个像素被文字盖住了」。
   关键是 `expect` 由**字色自己**决定，不再由全局最大差值决定——
   所以低对比度区域不会因为「差得不够大」而被筛掉。
2. **算「这个落点对比多少」**——文字颜色按该片段自己的计算色，
   底色取该落点的实际底色，判定值 = `contrast(eff, bg)`，
   取**所有落点里的最小值**。

配套修的三处：

| 复验要求 | 处理 |
|---|---|
| 多色后代按各自实际字色配对 | 片段逐文本节点取，`color` 取**该文本节点父元素**的计算色；`<span>` 强调色不会再被父级字色覆盖 |
| 不用「全局最大差值 90%」定义取样位置 | 取样位置改为覆盖率 α 掩膜，与对比度数值无关 |
| 防止动画/边框/图标污染 | 文字位置由 α 掩膜给出；图片/图标/视频等子元素矩形记为 obstacle 不参与判定；测前冻结动画、等字体加载完 |

另外补了两个**忠实度修正**：

- **元素 opacity 参与字色合成**。`.zh-pair__watermark` 用 `opacity: 0.16`，
  旧算法按声明色算成 5.58:1（偏高），实际渲染出来只有 **1.26:1**。
  现在逐级累乘元素与祖先的 opacity，字色按真实合成结果算。
- **只在页面稳定时测**。入场动画期间元素 opacity 可能只有 0.05
  （framer-motion 淡入实测 0.44→0.97→1），这时候量到的「字色」是半透明中间态，
  会把真实的 14:1 报成 **1.25:1**。现在测量前轮询到没有有限动画在跑为止（不用固定 sleep），
  仍不稳定的会标 `settled: false` 留痕。

#### 算法回归（复验方点名要求）

`scripts/contrast-appearances.mjs` 里新增 `runAlgorithmSelfTest()`，
**在正式测量之前**执行，失败直接 `process.exit(1)`：

- 反例（黑字压 `#333` 底）必须 **低于阈值** 且**进入失败列表**；
- 合格样例（黑字压白底）必须**保持通过**。

当前自检输出：

```
=== 算法自检 ===
  反例（黑字压 #333 底）: weakestRatio=1.66 最弱落点={"x":262,"y":27}
  合格样例（黑字压白底）: weakestRatio=21
  自检通过
```

反例的 1.66 与复验方手算的 1.6621:1 一致，最弱落点也落在**右半边**（x=262 > 250），
不再是旧实现的白底位置。

#### 重跑结果

`node scripts/contrast-appearances.mjs` → **退出码 0**：

| 指标 | 上一轮 | 本轮 |
|---|---|---|
| 判定元素 | 458 | 458 |
| 通过 | 454 | **454** |
| 失败 | 0 | **0** |
| 豁免（装饰元素） | 4 | **4** |
| 未覆盖 | 0 | **0** |
| 非豁免最低对比度 | 4.83:1 | **4.83:1**（`.ql-cast__submit`） |

4 项豁免都是 `aria-hidden` 的装饰元素，其中 2 项朱砂水印现在按真实 opacity
报 **1.26:1**（旧算法虚报 5.58:1）——豁免理由不变（水印不承载信息），
但**数值不再好看化**。抗锯齿像素比值仍保留在报告里，但只作参考量，不作门禁。

### 0.2 [P3] 真实缩放：核对实际宽度，没到标称档位就单列

复验方在交付的 JSON 里查到 `half-390-window` 的 9 个组合全是
`requestedCssWidth 195 / actualCssWidth 243 / actualInnerWidth 251 / dpr 2.5`，
而脚本没有任何偏差校验，仍按「195px 档已完整覆盖」记账。

本轮处理（`scripts/zoom-real-200.mjs`）：

1. **逐组核对**：`actualCssWidth` 与 `requestedCssWidth` 的偏差超过
   `WIDTH_TOLERANCE = 20px`（滚动条/边框带来的正常差约 15px）即判定**没量到标称档位**。
2. **单列记账**：这类组从「达到标称档位」里拿出来，记为 `platformLimited`，
   写进报告新增的 `platformLimits` 数组（含标称值、实测值、偏差、原因）。
   **不算产品失败**——复验方明确不要求支持 195px。
3. **更正档位说明**：`half-390-window` 的 note 改成
   「请求物理窗口 390px @200% → 标称 CSS 视口 195px；Windows 上浏览器有最小窗口宽度
   （约 500 物理 px），实际只能到约 243px CSS；脚本会核对实测宽度并把这一档标为
   『平台限制档』，不按 195px 记账。」
4. 报告每行新增 `widthDeviation` / `widthMatched` / `effectiveTier` 字段。

重跑结果（退出码 0）：

```
覆盖 54/54 组；失败 0 项 / 豁免 0 项
其中达到标称档位 45 组，平台限制档 9 组（见下）
平台限制档（没量到标称 CSS 视口，按实测值记账）：
  - half-390-window：标称 195px → 实测 243px（实际 CSS 视口比标称宽 48px：
    浏览器最小窗口宽度限制，标称 195px 未达到（实测 243px））
```

对照复验方查到的那张表，现在**每一档的实际宽度都在报告里可查**：

| 档位 | 标称 CSS 视口 | 实测 CSS 视口 | 偏差 | 记账 |
|---|---|---|---|---|
| css-1440 | 1440 | 1425 | −15 | 达到标称档位 |
| css-768 | 768 | 753 | −15 | 达到标称档位 |
| css-390 | 390 | 375 | −15 | 达到标称档位 |
| half-1440-window | 720 | 705 | −15 | 达到标称档位 |
| half-768-window | 384 | 369 | −15 | 达到标称档位 |
| half-390-window | 195 | **243** | **+48** | **平台限制档（按实测 243px 记账）** |

模拟矩阵（`acceptance-appearances.mjs`）里 195px 档仍是 9 条豁免，
豁免理由写的是实测值 212px、原因「CSS 视口 195px 低于本项目设计下限 320px，
本档不判失败，仅记录」——与本轮口径一致。

### 0.3 本轮复测与门禁

| 命令 | 结果 |
|---|---|
| `node scripts/appearance-journey.mjs` | 退出码 0，全部通过 |
| `node scripts/acceptance-appearances.mjs` | 退出码 0，0 失败 / 9 豁免 / 174 断言 |
| `node scripts/contrast-appearances.mjs` | 退出码 0，454 通过 / 0 失败 / 4 豁免 / 0 未覆盖（含算法自检） |
| `node scripts/zoom-real-200.mjs` | 退出码 0，54/54 组，45 组达到标称档位 + 9 组平台限制档 |
| `npm test` | 通过 |
| `npm run typecheck` | 通过 |
| `npm run build` | 通过 |
| `cd worker && npm run build` | 通过 |

未改 Worker 路由，未重跑 Worker 集成测试；未运行 lint（本机不可用）。
`public/sitemap.xml` 按字节保留（构建会重写 lastmod，跑完即还原）。


---

## 1. P1-01：换外观丢输入、取数器被卸载、启卦卡死

### 1.1 根因（复验时请注意，这里与验收报告的描述有出入）

验收报告指出「切换视图重挂载输入与随机取数器」。**触发条件确实是重挂载，但重挂载本身不是根因**——
`DivinationForm` 里状态持有者的位置是对的。真正断链的是**状态所有权在两处**：

- 原始文本存在 `NumberBox` 内部（`useState`）；
- 滚动计时器、禁用态、10 秒自动停止存在 `useManualRandomizer` 内部（`useReducer` + `useState`）。

切换外观时 `CAST_VIEWS[appearance]` 换了**组件类型**，React 卸载整棵输入子树：
文本回到 `null` 初始值、三个取数器回到 `idle`。
但父层 `rollingNumbers` 仍是 `true`（它由自己的 `useState` 持有，卸载不掉），
于是 UI 停在「灵数流转中」而页面上已经没有对应的「停止」按钮——**启卦被永久禁用**。

这也解释了验收报告复现 B 的第 5 步：手改成 329 也救不回来，
因为父层等的是「子组件把停止事件回传」，而子组件已经被卸载了。

### 1.2 处理

把**原始文本 + 三个取数控制器**整体上移到稳定层，视图只负责画与回调：

| 位置 | 职责 |
|---|---|
| `src/components/ui/NumberBoxRandomizer/state.ts`（新增） | `useNumberBoxesState()`：持有三格的原始文本、合法值、取数状态；`useManualRandomizer` 调三次，`onLock` 回调把落定值写回同一位 |
| `src/components/ui/NumberBox.tsx` | 改为**受控**（`text` + `onTextChange`），保留 `data-filled` / `aria-invalid` |
| `src/components/ui/NumberBoxRandomizer/index.tsx` | 改为**受控**（`field` + `onTextChange/onStart/onStop`），滚动态由上层给出 |
| `src/components/appearances/shared/types.ts` | `CastAppearanceProps`：`numberFields` / `onNumberTextChange` / `onRandomStart` / `onRandomStop` / `isRolling` / `isValid` / `selectedCount` |
| `src/components/appearances/{qinglan,zhusha,yehang}/Cast*.tsx` | 三套起卦视图按新契约改写，不再各自持有输入与取数器 |
| `src/components/sections/DivinationForm.tsx` | 调用 `useNumberBoxesState(initialNumbers)`，由同一份状态派生 `numbers` / `selectedCount` / `isRolling` / `isValid` |
| `src/lib/numberText.ts`（新增） | 纯函数 `sanitizeNumberText` / `parseNumberText` / `numberToText`（最多三位、100–999），10 条单测 |

**没有**用清空、刷新、路由恢复、重新取数等手段掩盖问题；**没有**在切换时重置任何输入。

### 1.3 复验方法

组件级回归 `tests/components/AppearanceSwitchKeepsCastState.test.tsx`（6 例）：

| 用例 | 断言 |
|---|---|
| 未满两位数跨三方向保留 | 切换后文本仍是 `12`，未补齐成三位 |
| 无效三位 `099` 保留且启卦禁用 | 文本仍是 `099`，提交按钮 `disabled` |
| 滚动中切换后仍滚动 | 切到朱砂后 `data-state` 仍是 `rolling`，新外观出现「停 止」按钮；点停止后落定为三位数；进度文案「已选定 1 / 3 个灵数」 |
| 停止后再切换数字不变 | 停下的值在三个方向切换后一致 |
| 切回来仍在滚动且 10s 超时自动停止 | 滚动状态跨切换保留，`useManualRandomizer` 的 10 秒自动锁定照常生效 |
| 切换不新建记录 | 切换期间无记录写入 |

浏览器级回归在 `scripts/appearance-journey.mjs` 末尾（真实 UI 点击切换 + CDP 统计请求）：

```
未满三位的输入（"12"）跨外观切换后仍在，启卦仍禁用
无效三位（"099"）跨外观切换后原样保留，启卦仍禁用
第一格取数器进入滚动态 → 切换外观 → 仍在滚动，新外观里出现「停止」按钮
→ 点停止 → 灵数落定为一个三位数
```

### 1.4 结果

6/6 与 35/35 断言通过。切换期间新增 API 调用 = 0（不创建记录、不调 AI、不自动保存、不发布）。

---

## 2. P1-02：青岚书院不是 A 提案

### 2.1 原状与定性

上一版把交付说明 §3.4 写成「A 刻意保留朱砂红主色 / 保留现有生产调色板」，
并援引「brief §3.4」。**复核后确认 brief 里没有这条授权**——
brief 要求三套提案全部保留为正式外观，交付说明那句属于未经授权的偏离，
验收报告的判断成立。本轮按「A 提案就是 A 提案」重做，而不是把它写成「有意为之、验收通过」。

### 2.2 处理

**布局与插画组织**（三页整体重做，不是换配色）：

| | 提案 | 本轮实现 |
|---|---|---|
| 首页 | 左「慢下来，读懂此刻的自己。」+ 右拱形青绿山水插画；下接「今日卦境」与「从一卦，走向更辽阔的自己。」 | 同上，`.ql-home` 系列 class + `src/styles/appearance/qinglan-home.css` |
| 起卦 | 左「A MOMENT FOR YOURSELF / 把心事放下，让答案浮现。」+ 拱形山水 + 01 静心 / 02 问事 / 03 取数；右「THREE NUMBERS, ONE INSIGHT / 三数起卦」 | 同上，`.ql-cast` + `qinglan-cast.css` |
| 结果 | 「万象流转，自有回响。」+ 「此刻所问」问句条 + 本卦/变卦对读卡 + TAKE IT WITH YOU 侧栏 | 同上，`.ql-result` + `qinglan-result.css` |

**强调色**（A 换成提案自己的色板，落在语义令牌层）：

| 提案变量 | 值 | 语义令牌 |
|---|---|---|
| `--dg-bg` | `#f5f4ec` | `--color-bg-page` / `--color-rice` |
| `--dg-paper` | `#fcfbf5` | `--color-bg-paper` |
| `--dg-ink` | `#263e34` | `--color-text-primary` / `--color-ink` |
| `--dg-muted` | `#5c6c61` | `--color-text-muted`（**实现里加深到 `#56675c`**，原值在纸上只有 4.32:1，达不到 4.5:1） |
| `--dg-line` | `#d3dbcf` | `--color-border` |
| `--dg-accent` | `#355e4b` | `--color-accent`（主色）/ `--color-june-red` |
| `--dg-on-accent` | `#fffdf4` | `--color-on-accent` |
| `--dg-tint` | `#e9ede2` | `--color-bg-soft` |

`src/styles/tokens.css` 的 `:root` 即 A 外观，B / C 仍在 `src/styles/appearance.css` 覆盖同一批令牌；
旧调色板变量（`--color-rice` / `--color-ink` / `--color-june-*`）三套各自重映射，未改造的旧页面跟着换肤。

### 2.3 演示交互没有被当成业务实现

| 提案里的演示件 | 本轮实现 |
|---|---|
| 起卦页一枚「随机取三个数」 | **不实现**：一次摇三个数不是站点能力。改成三格各自一个「天降灵数」，走真实取数逻辑 |
| 结果页侧栏「我喜欢这个版式」 | **不实现**：换成真实的「收藏到卦册 / 发布到社区 / 下载卦象卡」 |
| 预置问句 | 用站点自己的问询池 `QUESTION_POOL`，不是演示假数据 |

真实业务能力保持原样：AI 解读走正式入口与流式协议，收藏/发布/下载走原有逻辑，记录只存一份。

### 2.4 并排核对证据

`screenshots/proposal-compare/` 六张截图（`proposal-a-{home,cast,result}.png` vs `impl-a-{home,cast,result}.png`），
请复验方直接比对。视觉核对结论：分区、层级、文案、插画组织、卡片关系与提案一致；
差异只在插画素材本身用站点现有资源、演示按钮换成真实动作。

---

## 3. P2-01：朱砂档案「已选定 x / 3 个灵数」9.6px

`src/styles/appearance/zhusha.css` 的 `.zh-status small` 原来靠 `<small>` 的 80% 继承算出来是 9.6px，
现在显式写 `font-size: var(--text-caption)`（12px）。

验收矩阵的 `字号<12px=0`（三套外观 × 9 页 × 5 宽度全过）。对照度见 §5。

---

## 4. P2-02：验收脚本不足以支撑「0 失败，全部完成」

逐条处理如下。

### 4.1 溢出不再只记日志

原来 `scripts/acceptance-appearances.mjs:243-247` 只把横向溢出 push 进 `failures` 之外的日志区，
对比度 / 字号 / 目标尺寸也只打印。现在**四类判定全部计入失败**，脚本以**非零码退出**。

### 4.2 200% 拆成「模拟矩阵」+「真实缩放」

| | 模拟矩阵 | 真实浏览器缩放 |
|---|---|---|
| 脚本 | `acceptance-appearances.mjs` 内一节 | **`scripts/zoom-real-200.mjs`（单独做）** |
| 命名 | 明确叫「模拟 200% 缩放（DevTools 同款：CSS 视口减半 + deviceScaleFactor=2，桌面模式）」 | 「真实浏览器 200% 缩放」 |
| 手段 | `Emulation.setDeviceMetricsOverride` | **有界面 Chrome + Win32 `keybd_event` 注入 Ctrl+'+'**（走「操作系统 → 浏览器进程 → 浏览器缩放级别」这条完整链路） |
| 覆盖 | 3 外观 × 3 页 × 3 宽 = 27 组 | 3 外观 × 3 页 × 6 档 = 54 组 |
| 结果 | 0 失败 | 0 失败 |

**真实缩放的自证判据（三条同时成立才算数）**：

| 指标 | 100% | 200% | 判定 |
|---|---|---|---|
| `devicePixelRatio` | 1.25 | **2.5** | ×2.000 ✅ |
| `window.innerWidth`（CSS 视口） | 1426px | **713px** | 收窄到 50.0% ✅ |
| `window.outerWidth`（物理窗口） | 1440px | **1440px** | 窗口没变 → 是页面缩放，不是把窗口改小 ✅ |
| `visualViewport.scale` | 1 | 1 | 不是捏合缩放 |

脚本保留了四级降级（系统注入 → CDP `Input.dispatchKeyEvent` → 每站点缩放级别 → `--force-device-scale-factor=2`），
**每一级的成败都写进报告**；最后一级只改 dpr、视口不变，在报告里明确标注「非真实缩放」并直接判失败
（第一版就走过这条路径，`real-zoom-not-verified`，EXIT=1）。
注意：headless 下浏览器**不处理**注入的按键，所以真实缩放必须有桌面会话，
脚本运行时会短暂地在桌面上出现 Chrome 窗口。

产物：`screenshots/zoom-real-200/`（54 张截图 + `zoom-real-200.json`，含缩放值、缩放前后 CSS 视口、方法与逐次按键过程）。

### 4.3 `cssW < 320` 的 195px 档不再静默省略

该档（模拟 200% 下 390px 物理窗口）低于本项目 320px 设计下限，
现在**逐条打印实测值与豁免理由**，并计入豁免数（9 条：3 外观 × 3 页），不再无声跳过。

### 4.4 页面矩阵补齐

页面从 7 类扩到 **9 类**：新增**社区 `/feed`** 与 **404**；加载态与错误态进矩阵。
现在 3 外观 × 9 页 × 5 宽度 = 135 组，另有模拟 200% 27 组、结果页四态 12 组，**共 174 组全覆盖**。

### 4.5 对比度指标重做

旧指标：取「差值 ≥ 最大差值 90% 的像素的中位色」当字色，再用同一像素处的底色算对比度。
**那测的是抗锯齿边缘，不是文字对比度**——例：A 卦册某处旧算法报 4.32:1，真实值 6.03:1。

新口径（三件事都改了）：

1. **判定值 = 文字真实 CSS 颜色（元素及其后代 color，按 alpha 合成）× 该文字每一处落点上的实际底色，取所有落点的最小值**（即「最弱落点」）；
2. 逐像素的抗锯齿值降级为参考量（`minPixelRatio`），不再当结论；
3. **先 `freezeScene()`（结束入场动画、暂停循环动画）再取色**——旧脚本在动画过渡中读 `getComputedStyle().color`，
   拿到的是插值色 `rgba(211,214,198,0.427)`，导致夜航 `.yh-btn--text` 误报 3.12:1（真实值 10.78:1）。

另外：裁剪框边缘 1px 会把描边重新光栅化，已从差集统计里排除（修掉页匾 h1 误报 1:1）；
**找不到目标元素不再静默跳过，计入失败**（「未覆盖」从 15 降到 0，并改成即失败）。

---

## 5. 复验结果汇总

### 5.1 门禁

| 门禁 | 命令 | 结果 |
|---|---|---|
| 前端单测 | `npm test` | 52 个文件 / **455 个用例**全部通过 |
| 类型检查 | `npm run typecheck` | 0 error |
| 前端构建 | `npm run build` | 通过（`public/sitemap.xml` 的 lastmod 已还原） |
| Worker 类型检查 | `cd worker && npm run build` | 通过（未改 worker 路由） |

> `npm run lint` 本机不可用（脚本/依赖缺失）。
> `npm test` 在浏览器验收脚本**并发**跑时曾偶发一次失败（5s 超时 + 「找到多个同名元素」），
> 单独跑与全量串行跑均通过，判断为并发负载下的时序抖动，非功能缺陷。**串行跑：455/455 通过。**

### 5.2 浏览器验收

> 下表是第一轮返工后的原始记录。**第二轮复验后的最新结果见 §0.3**
> （对比度算法重做 + 宽度口径核对后重跑，结论仍是 0 失败）。

| 脚本 | 覆盖 | 结果 |
|---|---|---|
| `scripts/acceptance-appearances.mjs` | 135 矩阵 + 27 模拟 200% + 12 结果四态 = **174 组** | 失败 **0** / 豁免 **9** / 覆盖 **174/174** |
| `scripts/contrast-appearances.mjs` | 458 个测量目标（454 文字 + 4 装饰）像素级实测 | 通过 **454** / 失败 **0** / 豁免 **4** / 未覆盖 **0**，最低 **4.61:1** |
| `scripts/appearance-journey.mjs` | 行为序列 + P1-01 回归段 | **35 项断言**全部通过 |
| `scripts/zoom-real-200.mjs` | 真实 200% × 3 外观 × 3 页 × 6 档 = **54 组** | 失败 **0** / 豁免 **0** / 覆盖 **54/54**，**真实缩放已验证** |

4 条对比度豁免全部是 `aria-hidden` 纯装饰（A 山水图注、题刻；朱砂卦名水印 ×2），每条写明理由。

### 5.3 关键截图

| 用途 | 位置 |
|---|---|
| 提案 vs 实现并排（A 三页） | `screenshots/proposal-compare/` |
| 三套外观 × 页面 × 宽度矩阵 | `screenshots/acceptance-appearances/` |
| 真实 200% 缩放 54 组 | `screenshots/zoom-real-200/` |
| 对比度原始探针与样点 | `screenshots/contrast/contrast-appearances.json`（含 12 个最低比值像素的 `textColor` / `backdrop` / `painted`） |
| 行为走查过程 | `screenshots/journey/` |

---

## 6. 独立复验建议路径

```powershell
npm install
npm run dev            # http://localhost:5173

npm test
npm run typecheck
npm run build          # 记得之后还原 public/sitemap.xml 的 lastmod
cd worker && npm run build

# 验收脚本（脚本自行管理浏览器；前三个共用 9222 的那个 Chrome 实例）
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
Start-Process $chrome -ArgumentList @('--headless=new','--disable-gpu','--remote-debugging-port=9222',"--user-data-dir=$env:TEMP\chrome-cdp-profile",'about:blank')
node scripts/appearance-journey.mjs        # 35 项，含 P1-01 回归段（用上面 9222 的实例）
node scripts/acceptance-appearances.mjs    # 174 组（用上面 9222 的实例）
node scripts/contrast-appearances.mjs      # 454 处（用上面 9222 的实例）
node scripts/zoom-real-200.mjs             # 真实缩放：自己起有界面 Chrome（9333），需桌面会话

# 人工核对 P1-02
#   http://localhost:5173/design-preview?direction=a&page=home|cast|result
#   对比 http://localhost:5173/ 、/divination 、/result/<真实记录 id>
```

**复验方请重点抽查三处**：

1. **P1-01 不要只看界面**：请确认输入框文本与滚动状态在切换前后**由同一份状态持有**
   （看 `src/components/ui/NumberBoxRandomizer/state.ts`），而不是靠「切回来再填一次」绕过。
2. **真实缩放的判据**：不要只看 `deviceScaleFactor`，必须确认 **CSS 视口收窄且物理窗口尺寸不变**。
3. **对比度的判定值**：请抽查报告里 `weakestRatio` 最低的几行，
   确认 `weakestFg`（文字真实颜色）与 `weakestBg`（落点实际底色）确实来自被测元素。

---

## 7. 本轮新发现并修掉的问题

| 问题 | 根因 | 处理 |
|---|---|---|
| 对比度脚本把抗锯齿边缘当成字色 | 取「差值 ≥ 最大差值 90% 的像素中位色」 | 主指标改为「文字真实 CSS 颜色 × 落点实际底色」的最小值；逐像素值降级为参考量 |
| 夜航 `.yh-btn--text` 误报 3.12:1（真实 10.78:1） | 在动画过渡中读 `getComputedStyle().color`，拿到插值色 | 先 `freezeScene()` 再取色 |
| 页匾 h1 误报 1:1 | 裁剪框边缘 1px 把描边重新光栅化 | 差集与字芯统计排除 1px 边框环 |
| 对比度大面积「未覆盖」 | A 的类名换成了 `ql-*`，脚本还在找旧类名 | 更新选择器；未覆盖从 15 → **0**，并改成「找不到即失败」 |
| 验收矩阵 31 项夜航失败 | **Vite 提供了过期的 `yehang.css`**（编辑后 mtime 未变） | 改完文件统一 touch `src/**` 的 mtime，重跑后失败数归零 |
| A 的 muted 辅助文字（--color-text-muted `#5c6c61`）在纸面上对比度不足 | 提案色板里的 muted 值比 A 其它色深一档，不足以在纸上过 4.5:1 | 加深到 `#56675c`（`src/styles/tokens.css`） |
| 灵数 label、「所问之事」label、「再起一卦 →」、「返回首页」、面包屑「首页」点击区 <24px | 纯文本 label 没有最小高度 | 30 条 `min-height:24px` 规则（青岚/朱砂/夜航/旧页面样式表）+ 2 处 TSX 的 `min-h-6` |
| 验收脚本偶发把「页面没渲染」判成失败 | 导航切换瞬间 `document.body` 为 `null`，`document.body.innerText` 抛 TypeError，被外层当成「页面未渲染」 | 三个脚本的探针改成 `(document.body && document.body.innerText) \|\| ''`；轮询遇瞬时异常继续轮询，只有连续到超时才判失败 |
| 预置问句断言硬编码字符串 | A 的预置问句改用站点问询池 `QUESTION_POOL` | 断言改为「来自问询池」+ 与保存记录一致，不再逐字硬编码 |

---

## 8. 仍存在的问题 / 未做

1. **云端接口在本地跑不通**：Worker 未启动时「我的卦册」「社区卦册」显示「云端卦册加载失败：HTTP 500」，
   页面本身优雅降级（本地卦册照常可用）。这是**本地环境边界**，不是缺陷。
2. **AI 解读走 mock / 本地代理**：需要 Pages Functions（:8788）+ `.dev.vars` 的 `AI_DEMO_KEY`。
   本次验证的是**流式过程中的状态保持**，不是真实模型返回。
3. **输入框填充与页面底色 ≥3:1 在 C 调色板内做不到**：夜航所有背景令牌亮度都挤在 L 0.012–0.051，
   把输入框填充拉出 3:1 会让正文只剩 2.7:1。按 WCAG 1.4.11 原文把 3:1 落在**控件边界**
   （`--color-control-border` 对底色 4.14~4.20:1），正文仍保持 ≥4.5:1。
4. **旧页面只换肤不改版**：图鉴 / 卦册 / 社区 / 卦象详情仍是原版式；
   A 外观下这三页之外的功能页也仍是第一轮的换肤方案。
5. **A 的强调色已与提案一致**（上一版「不一致是有意为之」的说法已删除）。
6. **死代码**：`src/components/hexagram/TwinSpread.tsx`、`src/components/hexagram/FlipEntry.tsx` 仍无人引用。
7. **`npm run lint` 本机不可用**。
8. **真实缩放需要桌面会话**：无头 / CI 环境只能跑模拟矩阵。

---

## 9. 交付形态

- 全部改动**留在工作区，未 commit / 未 push / 未部署**；`git log` 顶端仍是 `16ce92d`。
- `git status`：44 个已跟踪文件被修改、48 组新文件，**0 个已暂存**。
- 本轮核心文件：
  - 稳定层：`src/components/ui/NumberBoxRandomizer/state.ts`、`src/lib/numberText.ts`
  - A 提案重做：`src/components/appearances/qinglan/*`、`src/styles/appearance/qinglan-{home,cast,result}.css`、`src/styles/tokens.css`
  - 验收脚本：`scripts/acceptance-appearances.mjs`、`scripts/contrast-appearances.mjs`、
    `scripts/appearance-journey.mjs`、`scripts/zoom-real-200.mjs`、`scripts/shared-appearances-probe.mjs`
  - 回归用例：`tests/components/AppearanceSwitchKeepsCastState.test.tsx`、`tests/lib/numberText.test.ts`
- 交付说明已同步更新：`docs/reviews/2026-10-23-three-appearances-implementation.md`
  （§0.1 返工对照表、§0.1.1 第二轮复验对照表、§3.4 令牌映射、§7.1.3 宽度口径、
  §7.2.1 对比度算法、§8.3 缺陷表）。

---

## 10. 第二轮复验后的补充说明（2026-10-23）

- 本轮（第二轮复验遗留项）**没有改动任何业务代码**——只动了两个验收脚本
  （`scripts/contrast-appearances.mjs`、`scripts/zoom-real-200.mjs`）和两份交付文档
  （本文与 `...-implementation.md`）。`src/` 与 `worker/` 的改动仍是第一/第二轮返工留下的，
  本轮没有新增。
- 对比度脚本的两处「忠实度修正」（元素 opacity 入算、等页面稳定再测）会让个别数字变化：
  朱砂装饰水印由旧算法的 5.58:1 变成真实的 **1.26:1**（豁免理由不变，装饰不承载信息）；
  非豁免项最低值从 4.61:1 变为 **4.83:1**（取样口径变化所致）。
- 新增的算法自检是**硬门禁**：`contrast-appearances.mjs` 在正式测量前先跑反例，
  不过就 `process.exit(1)`。复验方可只跑这一个脚本就确认算法没退化。
