# 首页 / 三数起卦（含结果页）改造 —— 质量评审

日期：2026-10-22
评审对象：工作区未提交改动（`git diff HEAD`：20 个已跟踪文件 + 12 个新文件，约 +1425 行 TSX + 3000 行新 CSS）
评审方式：全量 diff 走查 + 门禁执行 + 无头 Chrome（CDP）四档宽度整页截图与 DOM 探针比对

---

## 一、结论

**功能可发，视觉与设计系统不可发。**

- 既有测试覆盖的行为通过（45 文件 / 389 用例）；但 AI 调用、云端记录、社区发布等路径此前以模拟响应或本地实例验证，**不能替代真实部署环境的验收**——因此「可发」应理解为「无已知破坏性回归」，不是已验收可发布。
- 响应式在 1440 / 1024 / 768 / 390 四档均未破损。
- 但首页、三数起卦、结果页换了一整套新皮肤，图鉴 / 卦册 / 社区 / 卦象详情仍是旧皮肤 → 同一个 Header 在不同页面呈现两种视觉语言。
- 新页面整体脱离 `src/styles/tokens.css`：自带调色板、自带中文字体、硬编码色值，设计令牌改动无法传导到首屏三页。
- 小字可读性不达标：首页 15 组正文级文字对比度低于 WCAG AA，最低 1.89:1；移动端出现 7–9px 中文。

## 二、门禁（实测）

| 门 | 结果 |
|---|---|
| `npm run typecheck` | 0 错 |
| `npm test` | **45 文件 / 389 用例全过**（改造前基线 374，净增 15） |
| `cd worker && npm run build` | 未改动 worker，未跑 |
| `npm run build` | 未在本轮重跑（`public/sitemap.xml` 曾被 prebuild 刷新 lastmod，属构建噪音） |

## 三、验证材料

截图与 DOM 探针存放于临时目录（不在仓库内）：

```
%TEMP%\dsh-shots\
```

| 文件 | 用途 |
|---|---|
| `home-{desktop,tablet-1024,tablet-768,mobile}.png` | 首页四档宽度整页 |
| `divination-{desktop,tablet-1024,tablet-768,mobile}.png` | 三数起卦四档宽度 |
| `result-desktop.png` | 结果页（预置一条 localStorage 记录后渲染） |
| `codex-desktop.png`、`records-desktop.png` | 未改版页面，作为「两套皮肤」对照证据 |
| `zoom-home-hero.png`、`zoom-home-daily.png` | 首页英雄区、今日卦境卡片放大 |
| `zoom-div-numbers.png`、`zoom-div-filled.png` | 灵数输入框空态 / 填数态 |
| `probe-*.json`、`report.json` | 字号分布、溢出元素、点击区尺寸、元素几何原始数据 |
| `shoot*.mjs` | 驱动脚本，可重跑 |

---

## 四、做得好的（先说清楚，不是全盘否定）

1. **新皮肤内部自洽**：sage 绿 + 宣纸底 + 宋体标题的编辑感明显强于原来「红色大方块 + 浓墨」的方案，栅格、留白、分隔线统一。
2. **响应式是调过的**：768 / 1024 单独调了字号与栅格，不是简单堆叠；四档宽度实测无横向溢出。
3. **a11y 有意识**：`role="alert"` 报错、`aria-live` 状态行、`aria-current` 导航态、`aria-labelledby` 分区、`prefers-reduced-motion` 全局兜底齐备。
4. **结果页是本轮最扎实的产物**：本卦/变卦对照 → 动爻原文 → AI 详解三层结构；「收藏到卦册」的云端状态细分「本地已存 / 本地与云端已存」（`ResultDisplay.tsx:466`）；侧栏带发布到社区的隐私提示。
5. **顺手修了真 bug**：`Footer` 的「易学书院」原指向不存在的 `/academy`（404），现指向 `/codex`；`/result/*` 下导航高亮回落至「三数起卦」（`Header.tsx:18`）。

---

## 五、P0 —— 提交前必修

### 1. 两套皮肤并存，同一个 Header 长两个样

`src/styles/studio.css:32-120` 的 `> header` / `> footer` 皮肤只在根节点带 `.studio-page` 时生效，而只有三个页面传了 `rootClassName`：

- `src/pages/Home.tsx:62`
- `src/pages/Divination.tsx:9`
- `src/pages/Result.tsx:13`

`Codex` / `HexagramDetail` / `Records` / `Feed` / `Settings` 仍是裸 `PageLayout`。

实测差异：首页 Header 纸色无边框 + 红字下划线高亮；切到「64 卦图鉴」立刻变成 2px 赭石下边框 + 朱红胶囊高亮，Footer 底色由 `#eeefe7` 变回 `bg-rice-dark`。同时 `tests/components/Layout.test.tsx:33` 仍在断言旧皮肤的 `bg-june-red`，说明两侧都未对齐。

**修复**：把皮肤从「页面传 rootClassName」上移到 `PageLayout` / `Header` / `Footer`（`variant` 或默认新皮肤），确保 9 个路由只有一种 chrome。

### 2. 新页面整体脱离 tokens.css

- `src/styles/studio.css:2-9` 另起 `--studio-paper:#f9f8f3`、`--studio-ink:#2c3733`、`--studio-red:#9e4737`，与 `tokens.css` 的 `--color-rice:#FAF6EC`、`--color-ink`、`--color-june-red:#9B2C2C` 并存且**色值不同**（两个红肉眼可辨）。
- `src/styles/studio.css:9` 以 `font-family:'Microsoft YaHei','PingFang SC',sans-serif` 覆盖 `--font-body`（霞鹜文楷/楷体）→ 新页面正文黑体，图鉴/卦册正文楷体。
- 三份新 CSS 硬编码色值：`home.css` 72 处、`divination.css` 83 处、`result.css` 122 处；对 `var(--color-*)` 的引用为 **0**。
- `.studio-page{font-size:14px}` 把全局 16px 基准压低，仅作用于这三页（含共享 Header/Footer）。

**修复**：`--studio-*` 改为 `var(--color-*)` 别名；正文回 `var(--font-body)`、标题回 `var(--font-display)`；移除 14px 基准。

### 3. 小字号 + 低对比度（实测）

首页 15 组正文级文字低于 AA（4.5:1）：

| 选择器 | 对比度 |
|---|---|
| `.home-path-top > span`（`home.css:442`） | **1.89:1** |
| `.reading-toolbar > span`（`home.css:514`） | 2.62:1 |
| `.hero-footnote`（`home.css:114`） | 2.79:1 |
| `.section-aside`（`home.css:398`） | 3.02:1 |
| `.hero-scroll`（`home.css:130`，可点击链接，高 14px） | 3.07:1 |
| 页脚版权（`studio.css:114`） | 2.91:1 |

字号：`.daily-symbol-number` 移动端 **7px**（`home.css:761`）、`.hero-art-caption` 8px、`.hero-scroll` 9px、`.daily-number` 8–9px；起卦页 DOM 统计 24 个元素 11px、12 个 10px。

**修复**：muted 色阶整体压暗至 ≥4.5:1；7–9px 全部抬到 ≥11–12px；`.hero-scroll` / `.daily-divination` 给到 ≥24px 点击区。

### 4. 靠 4 层 DOM 结构与中文 aria-label 改共享组件

`studio.css` 使用 `.studio-page > header > div > a:first-child > div > span:first-child`（logo 字标）、`header a[aria-label='设置'] svg`（设置齿轮）等选择器。Header 任何结构调整或文案改动都会静默失效，且无测试可发现。

**修复**：`Header` / `Footer` 接受 `variant`/`className` 并输出显式 class；不再以可访问名作样式钩子。

---

## 六、P1 —— 建议同批修

### 5. NumberBox 是「刷漆」而非改造

`src/components/ui/NumberBox.tsx:91` 仍保留 40 余个旧 Tailwind 类（`bg-gradient-to-b from-june-bronze/40 … text-rice shadow-inner`），被 `src/styles/divination.css:321` 起的规则逐条以 `background/border/box-shadow:none` 覆盖。实测输入框 `border:0`、背景透明、占位符为 `"···"`——空态无任何可输入暗示，仅靠 1px 卡片边；「天降灵数」为裸文字（高 33px、无边框无底色），缺乏按钮外观。

### 6. 死代码与重复

- `TwinSpread`、`FlipEntry` 在生产代码中已无引用（仅剩各自测试）。
- `Home.tsx` 手写 `.hexagram-card-top` / `.hexagram-card-symbol`，与 `HexagramCard` 职责重复。
- `yaoLines.map(l => l.type) as YaoLineStackProps['lines']` 在 `Home.tsx:218`、`DailyHero.tsx:72`、`ResultHexagram.tsx:20` 三处复制（`HexagramCard` 已有等价 helper）。
- `Home.tsx:35` 的 `divination-path`、`DailyHero.tsx:50` 的 `daily-section` 无对应 CSS 规则。

### 7. 信息架构偏移

- 首页 `h1` 现为 slogan「于变化之中，寻一份从容。」；`今日卦境` 为 `h2`（`DailyHero.tsx:54`）、卦名为 `h3`（`DailyHero.tsx:90`），层级本身无误，但整块位于 528px 英雄区之下（768 以下需滚动），而导航首项仍叫「今日卦境」指向 `/`，`<title>` 亦为「今日卦境 · 易象阁」——h1 与页面主实体脱节，首屏也看不到主内容。
- `DailyHero.tsx:57` 丢失原有时区展示（`Intl.DateTimeFormat().resolvedOptions().timeZone`）；每日卦按时区计算，该信息是解释「为何他人所见不同」的唯一线索。

### 8. 交互细节

- `DivinationForm.tsx:103` 的 `submitting` 处于同步 `try/finally` 中，「起卦中…」永不渲染，`if (submitting) return` 为死守卫；按钮 `disabled` 使 `buildNumberError` 的错误分支不可达。
- 首页主题切换用 `role="group"` + `aria-pressed`，`aria-controls` 指向普通 `div`，切换后无 `aria-live`，读屏用户无感知。
- `YaoLineStack` 硬编码 `role="img" aria-label="hexagram"`，首页渲染 5 遍，中文界面被朗读 5 次英文。
- `src/components/motion/PageTransition.tsx:13` 直接配置 `initial/animate/exit` 位移动画，未接 `useReducedMotion`；`studio.css` 的 CSS `prefers-reduced-motion` 兜底管不到 Framer Motion 的 JS 动画 → 「减少动态效果」对该组件形同虚设（**待实测确认**）。

### 9. 测试偏薄

净增 15 个用例对应约 1400 行 TSX。`tests/pages/Home.test.tsx` 仅 2 例，未覆盖首页自身层次与「今日卦境」渲染；删除 `<DailyHero />` 时首页专属测试仍全绿，只有 `tests/pages/Smoke.test.tsx:30`（断言「今 日 卦 境」存在）会红——总门禁有粗粒度兜底，首页测试仍应加强。此外混入了 Footer 链接断言与 `getAllByRole('link')).toHaveLength(5)` 这类结构性脆断言。

### 10. 仓库卫生

`public/sitemap.xml`（构建 lastmod 噪音）、`vite.config.ts`、`src/lib/apiConfig.ts`、`tests/lib/apiConfig.test.ts`、`verify-local.ps1`、`.tmp-wrangler.err` 与本次改版混在同一工作区，未分组。

---

## 七、执行顺序（按评审结论调整后）

> 本节为定稿顺序；与上文「建议顺序」不一致处以本节为准。

1. **先统一公共框架与令牌。** `Header`/`Footer` 使用显式 class，去掉依赖 DOM 层级与中文可访问名的样式选择器；把已认可的新配色整理成语义令牌（页面、卡片、正文、辅助文字、边框、强调色），**不映射回旧色值**。
2. **再修可读性与首页层次。** 正文以 14–16px、辅助信息以 ≥12px 为目标（项目规范，非 WCAG 字号要求），按实际背景逐项复测对比度；恢复时区展示，并缩短手机首屏英雄区，让「今日卦境」更早出现。时区措辞需准确：影响的是日期归属/日界，并非时区不同就必定不同卦。
3. **整理表单与可访问性。** 数字输入框增加清晰输入暗示；随机取数按钮增加按钮外观；移除没有实际等待过程的 loading，保留提交校验。重复装饰卦图可隐藏，独立表达信息的卦图须提供中文名称，不能一律 `aria-hidden`。
4. **最后做组件收敛与验收。** 抽取爻线转换 helper 并补测试；**不要为了复用把首页卡片塞回旧版 `HexagramCard`**，先明确卡片变体或共享基础结构，避免再次靠 CSS 覆盖旧皮肤。无引用组件清理放在后面，不阻塞可读性修复。

**验收要求：** 每步先做定向检查，完成后再跑完整门禁；另需补跨页面外观、320px 窄屏、放大阅读（200%）、减少动态效果的实测。工作区原有的 API 配置、Vite 配置与临时文件应单独保留归组，不得顺手清理。

## 八、已定决策（2026-10-22）

| 项 | 决策 |
|---|---|
| 统一方向 | **保留新视觉**；全站统一 Header、Footer 与基础令牌，其他页面的业务内容逐页改造 |
| 本轮范围 | 首页、三数起卦、结果页，含其依赖的共享组件 |
| 交付方式 | 先展示 diff 与验收结果；**未经明确要求不 commit、不 push** |

## 九、评审修订记录

接受以下修正（原文已就地更正）：

1. 「逻辑零回归、功能可发」过满 —— 389 项测试只证明既有覆盖行为通过，AI/云端/发布路径此前为模拟响应验证，不等于真实部署验收。
2. 标题层级描述有误 —— 「今日卦境」是 `h2`（`DailyHero.tsx:54`），卦名是 `h3`（`:90`）；真正的问题是大标题被营销 slogan 占用、主内容落在首屏之下。
3. 「删除 DailyHero 后仍全绿」不准确 —— `tests/pages/Smoke.test.tsx:30` 有断言兜底；应表述为首页专属测试未覆盖。
4. 统一令牌 ≠ 恢复旧配色与楷体 —— 应把已认可的新视觉收录进 `tokens.css`，统一颜色角色与字体选择。
5. 主题筛选不必强制改造为 tabs —— 保留筛选按钮 + `aria-pressed` 并补结果状态播报即可；若改 tabs 必须同时实现键盘交互。
6. 可读性标准需分清 —— 普通文字 4.5:1，大字/纯装饰另有规则；「≥12px」是项目规范而非 WCAG 统一字号要求；触控目标要结合尺寸与间距判断。
7. 漏项：CSS `prefers-reduced-motion` 不能证明 Framer Motion 已降级 —— `PageTransition.tsx:13` 需补处理并实测。

---

## 十、执行记录（2026-10-22，第四步之后）

按第七节的顺序执行完毕，**未 commit、未 push**，工作区保持可审阅状态。

### 步骤 1 · 公共框架与令牌

- `Header`/`Footer` 改为只输出语义 class（`site-header__*` / `site-footer__*`），皮肤上移到 `src/styles/studio.css` 的全站框架段，9 个路由共用一套外观；删掉了依赖 DOM 层级与中文 `aria-label` 的样式选择器。
- `PageLayout` 统一为 `.site-shell > .site-header + .site-main > .site-main__inner + .site-footer`，容器宽度 1280（页面内容区）。
- `tokens.css` 新增语义令牌：页面/纸面/卡片/下沉/强调/底栏底色，正文/次级/辅助文字三档（最低 4.9:1），强调红、成功绿、装饰/控件边界三档边框，`--font-ui` 无衬线（正文仍用 `--font-body` 楷体），字号基准 15/13/12px。**新配色直接进令牌，没有映射回旧色值。**
- 旧 ` Minerals` 色板（`--color-june-*` / `--color-rice` / `--color-ink`）保持原值，未改造页面的业务内容不受影响。

### 步骤 2 · 可读性与首页层次

- 三份页面 CSS 里 **116 处字面色**换成语义令牌；`font-size` 小于 12px 的一律抬到 12px（正文 15px、辅助 12–13px）。
- 恢复时区展示，并按准确措辞说明：「时区 {tz} · 每日卦象按本地日期计算，跨过日界时各地区可能看到不同卦象」。
- 手机首屏英雄区 650px → 480px，h1 43px → 38px，「今日卦境」提前进入首屏；移动端「向下，遇见今日」由浅色改为正文色（原先在浅色渐变上几乎不可见）。

### 步骤 3 · 表单与可访问性

- `NumberBox` 去掉 40 余个旧 Tailwind 皮肤类，改由 `divination.css` 单独负责；输入框补可见落笔线（`--color-control-border`，对背景 ≥3:1）。
- 「天降灵数」由裸文字改为带边界的胶囊按钮；禁用态按钮改为浅底深字。
- 移除没有等待过程的 loading（`submitting` 状态与「起卦中…」文案），**提交校验保留**（取数未完成时阻止起卦并给出提示）。
- 卦图分级：`YaoLineStack` 新增 `label`；无 label 时按装饰性图形 `aria-hidden`，今日卦境主卦图给出「{卦名}卦象图」，结果页本卦/变卦由外层 `role="img"` 提供名称。
- 主题筛选保留按钮 + `aria-pressed`，补 `role="status"` 播报「已切换到「进退有时」，显示 4 个卦象」。
- `PageTransition` 接入 `useReducedMotion()`，减少动态效果时不做位移动画。

### 步骤 4 · 组件收敛与验收

- 抽出 `src/lib/hexagramLines.ts`（`hexagramLineTypes` / `hexagramLineStates`），消除三处 `as YaoLineStackProps['lines']` 断言，并补 `tests/lib/hexagramLines.test.ts`（8 例）。
- 首页卦象卡**未**塞回旧 `HexagramCard`（按要求先定变体）；`TwinSpread`/`FlipEntry` 清理按要求后置，未阻塞本轮。
- 独立操作链接补到 ≥24px 点击区（首页动作链接、面包屑、页脚链接、设置齿轮）。

### 验收结果（CDP 实测，无头 Chrome）

> **本节数据已于评审复核后重做**（见第十一节）。下表是复核前的记录，保留以便对照；
> 复核指出其中「放大阅读」与「减少动态效果」两项证据无效，原因是脚本没有断言页面
> 真的加载成功，连接失败也会输出「无溢出」。**以第十一节为准。**

| 页面 | 视口 | 横向溢出 | 文字对比度不足 | <12px 文字 | 点击区 <24px |
|---|---|---|---|---|---|
| 首页 | 1440 / 390 / 320 | 无 | 0 | 0 | 1（句内链接） |
| 三数起卦 | 1440 / 390 / 320 | 无 | 0 | 0 | 0 |
| 结果页 | 1440 / 390 / 320 | 无 | 0 | 0 | 0 |
| 64 卦图鉴 | 1440 / 390 / 320 | 无 | 0 | 0 | 0 |
| 我的卦册 | 1440 / 390 / 320 | 无 | 2 | 9 | 1 |

- **放大阅读**：1440 视口放大 200%（等效 720 CSS 宽）与 375 视口放大 200%（等效 360 CSS 宽）下，5 个页面均无横向溢出。 ⚠️ 复核判定该证据无效，见第十一节。
- **减少动态效果**：开启 `prefers-reduced-motion: reduce` 后，首页/起卦页/结果页均无 JS 驱动的位移或透明度动画。 ⚠️ 复核判定该证据无效，见第十一节。
- **跨页面外观**：5 个页面顶栏高度一致（桌面 84px / 移动 125px），激活态统一为「朱红文字 + 下划线」，页脚统一。
- 装饰性水印（首页 60px 卦名字样、结果页 84px 水印、插画题字）已 `aria-hidden`，按「纯装饰」豁免对比度要求。

### 门禁

| 门 | 结果 |
|---|---|
| `npm test` | **46 文件 / 403 用例全过**（基线 374，本轮 +29） |
| `npm run typecheck` | 0 错 |
| `cd worker && npm run build` / `npm test` | 本轮未改 worker，未跑 |

### 仍未处理（下一轮）

1. **我的卦册**：2 处对比度 3.97:1、9 处 10–11px 文字（`--color-june-bronze` 与 `text-[10px]/[11px]`）——属旧页面业务内容，按「逐页改造」推进。
2. 图鉴/卦册/社区/卦象详情的**业务内容**仍是旧皮肤（框架已统一）。
3. `TwinSpread`、`FlipEntry` 无生产引用，待确认删除或复用。
4. 首页卡片与旧 `HexagramCard` 的关系：先定卡片变体或共享基础结构，再决定是否合并。
5. AI / 云端记录 / 社区发布路径仍需在真实部署环境验收（当前为模拟响应）。

---

## 十一、评审复核的四项反馈与处置（2026-10-22 17:40）

复核结论：修复方向正确，但不认可「执行完毕、验收通过」。以下四项已逐条处理，
**其中第 1、2 项的根因是我自己的验收方法有缺陷**（探针只看 CSS 背景色、
脚本没有加载断言），已连同脚本一起修好。

### ① [P1] 首页移动端图片背景上的低对比文字

**复核发现**（实测）：320px 下「探索六十四卦」约 1.51–1.68:1，说明文字与脚注局部不足；
我原先的探针只读 `background-color`，**完全没考虑图片背景**。

**复现（自建像素级探针）**：把元素文字设为透明后重拍同区域，两图差异即字形像素，
对应位置的像素就是它背后的真实底色。据此测得（修复前）：

| 元素 | 修复前（320px） | 修复后（320px） | 修复后（390px） |
|---|---|---|---|
| 探索六十四卦 | 1.2:1 | **6.15:1** | **6.15:1** |
| 说明文字 | 1.14:1 | **4.92:1** | **4.92:1** |
| 观象·玩辞·察变·知时 | 1.01:1 | **4.92:1** | **4.92:1** |
| 向下，遇见今日 | 1.0:1 | **6.42:1** | **6.42:1** |
| 东方智慧·当代生活 | 4.92:1 | 4.92:1 | 4.92:1 |
| 大标题（38px，大字阈值 3:1） | 10.67:1 | 10.67:1 | 10.67:1 |
| 一山一水，皆有回响（装饰题字） | 1.52:1 | **4.92:1** | **4.92:1** |

**处置**：采用「调整山水位置 + 纸色遮罩」的组合，而不是只加遮罩——
≤767px 时把山水带从英雄区上沿（150px）下移到 392px，让它成为底部一条远景带，
正文（题头/说明/按钮/脚注）全部落在纸面上；「向下，遇见今日」改成纸色小牌
（`rgba` 纸底 + 边框 + 圆角），题字挪到山水带上方的纸面区并改用墨色。
桌面端题字改用更亮的纸白 `#f7f7ec`，对最深山体也有 4.74:1。

### ② [P1] 两项验收证据无效 —— 已重做

复核指出的问题成立：

- 原脚本没有「页面是否真的加载成功」的断言，dev server 被我重启占用端口后
  截图拿到的是 `ERR_CONNECTION_REFUSED` 错误页，脚本照样输出「无溢出」。
- 改 `deviceScaleFactor` 不等于完成浏览器 200% 缩放验收。

**处置**：重写验收脚本 `acceptance-v2`（见下）：

1. 每次导航后断言：`document.readyState === 'complete'`、标题非空、
   **该页关键节点存在**（home→`.home-hero`、divination→`.divination-form`、
   result→`.result-layout`、codex→`main` …）、元素数 ≥30、正文无「拒绝连接/无法访问」字样；
   任一不满足即记为失败并**终止该项测量**，不会再输出「无溢出」。
2. 缩放改为浏览器 200% 的等价实现：**CSS 视口减半 + deviceScaleFactor=2**
   （与 DevTools 设备工具栏的 200% 缩放一致），并补一轮 pinch 缩放
   （`Emulation.setPageScaleFactor(2)`）验证视觉放大。
3. 证据落盘到 `screenshots/acceptance/`（含截图与 `acceptance-report.json`），
   便于人工复核（`screenshots/` 已在 .gitignore 内，不进版本库）。

**重做后的结果**：

| 项 | 结果 |
|---|---|
| 8 个页面 × 1440/768/390/320 | 全部通过加载断言，**无横向溢出**；首页/起卦/结果/图鉴 对比度与字号 0 失败 |
| 200% 缩放（1440→720css、768→384css） | 5 个页面均无横向溢出，截图已存档 |
| 200% 缩放（390→195css） | 出现横向溢出，但 **195 CSS px 低于 320px 设计下限**，按设计下限验收，不判失败（脚本中明确标注） |
| pinch 2x（390 视口） | 首页/起卦/结果 均无横向溢出 |
| 减少动态效果 | 见 ③，reduce 模式下滚轮不透明度恒为 1、无带动画元素；**正常模式对照组不透明度持续波动**（证明该断言有能力失败） |

### ③ [P1] 减少动态效果漏了随机取数

复核指出 `RandomizerReel` 每次数字更新都重新挂载并执行 `opacity 0.4 → 1`，已复现。

**处置**：
- `RandomizerReel` 接入 `useReducedMotion()`：reduce 模式下渲染普通 `div`，
  **不逐帧淡入、也不随数字变化重新挂载**，数字直接替换（功能不变，只是没有动画）。
- `App.tsx` 外层加 `<MotionConfig reducedMotion="user">`，全站的位移/缩放动画
  在用户开启「减少动态效果」后统一关闭（此前只有 CSS 层降级，JS 动画未降级）。
- 新增 `tests/components/NumberBoxRandomizerReducedMotion.test.tsx`（单独成文件：
  framer-motion 只在模块首次加载时探测一次偏好，与其它用例同文件会错过 mock），
  断言滚轮不再残留 `opacity` 初始态、且数字仍持续更新。

### ④ [P2] 令牌收拢未完成

复核指出起卦页、结果页背景仍写死，输入框背景重复已有令牌值。

**处置**：`tokens.css` 增补表面令牌
（`--color-bg-page/paper/card/panel/soft/sunken/raised/field/hero/warm/footer/error/disabled/disabled-sage/toast`
+ `--color-green-strong` + 三个 alpha 通道变量），
三份页面 CSS 共 **48 行**写死背景改为语义令牌（页面 2、卡片 7、控件 20、其余为纸面/面板/状态色），
输入框背景 `#f2f4eb → var(--color-bg-sunken)`、
textarea `#f7f8f1 → var(--color-bg-field)`；
`--studio-*` 过渡别名已彻底无人引用，连同别名段一并删除。
**插画与装饰色保留写死**（卦象线条、印章、连接线、进度条等，按复核意见允许）。

### 复核后的门禁

| 门 | 结果 |
|---|---|
| `npm test` | **47 文件 / 405 用例全过** |
| `npm run typecheck` | 0 错 |
| 像素级对比度（首页英雄区，320/390/1440） | 7 个元素全部 ≥4.5:1（标题 10.3:1） |

### 复核后仍未处理

1. **旧页面**（我的卦册 / 偏好设置）仍有对比度 3.97:1 与 10–11px 文字，根因是旧色板
   `--color-june-bronze`(#8B6914) 配 `--color-rice-dark`(#EDE2D0)；按「逐页改造」推进，
   本轮不动旧色板数值。
2. 社区卦册页的「加载失败：500」是本地未起 Worker（:8787）所致，属环境状态，非布局缺陷。
3. 其余遗留项同第十节。
