# 易象阁趣味化增强：卦象视觉升级 + 随机数动画（v3）

**日期**: 2026-08-10
**作者**: brainstorming → 架构 Agent 评审 → 用户最终确认
**状态**: v3 设计稿（用户最终拍板）

## 1. 修订历史

| 版本   | 关键决策                                                                            |
| ------ | ----------------------------------------------------------------------------------- |
| v1     | 初稿：html-to-image + 新组件 HexagramScroll                                         |
| v2     | 架构评审：复用 imageGen.ts 的 SVG 方案，新组件目录 NumberBoxRandomizer              |
| **v3** | **用户拍板：只调整卦象主体，保留现有 3:4.5 卡片尺寸与基础布局，不做整体卦笺重设计** |

## 2. 背景与目标

### 2.1 现状

`src/lib/imageGen.ts` 已经实现完整的 SVG→Canvas PNG 导出，`ResultDisplay.tsx` 的"♡ 收藏本卦"按钮已接入。视觉上是 720×1080 的"卦象卡"，含卦象 + 卦名 + 动爻标注 + AI 摘要 + 用户感言 + 时间戳 + 右下角水印。

### 2.2 问题

卦象主体（`imageGen.ts:74-92`）目前是简朴的几根 stroke：

- 阳爻：单根横线
- 阴爻：左右两段断线（gap = 12px）

没有任何装饰、没有质感、整体偏单薄。这是用户本次增强的明确诉求。

### 2.3 目标

1. **卦象主体视觉升级**：重做 SVG 六爻渲染，使其与项目国风/工笔质感匹配。**卡片整体框架（720×1080、配色、字体栈、各区块）保持不变**。
2. **随机数动画**：在 `DivinationForm` 三个灵数上加"随机"按钮，三 variant（reel/scroll/stem-branch）并存。
3. **零新依赖**：复用 framer-motion，不引入 html-to-image 等。

## 3. 范围与非目标

### 3.1 范围内

- `imageGen.ts` 中**仅六爻 SVG 渲染**重写（保持外部 API `renderCardSvg` / `downloadCardPng` / `cardDataFromIds` 完全不变）
- 新增 `NumberBoxRandomizer/` 组合组件目录（不动 NumberBox）
- `DivinationForm` 提交校验升级 + 错误提示精确化
- DEV-only variant 切换器

### 3.2 非目标（YAGNI）

- ❌ 卡片整体比例 / 布局重构（720×1080 保持）
- ❌ 卡片加卦辞 / 爻辞区块（用户已确认不做）
- ❌ 卡片加问询 / 灵数 / 起卦时间显示
- ❌ 收藏列表 / 卦册路由
- ❌ 用户偏好设置（动画风格切换）
- ❌ localStorage 新 schema
- ❌ 修改 `UserRecord`
- ❌ HexagramDetail 顶部次级入口
- ❌ html-to-image 等新依赖

## 4. 详细设计

### 4.1 卦象主体视觉升级（imageGen.ts）

#### 4.1.1 改动范围

**只改 `renderCardSvg` 函数内的 `lines` 生成循环**（`imageGen.ts:74-92`）。其它一切不动：

- 函数签名（`renderCardSvg(data: CardData): string`）不变
- 外部颜色常量 `C` 不变
- 外部字体栈 `FONT_DISPLAY` / `FONT_BODY` 不变
- 区块（hero / moving / AI / 感言 / 时间戳 / 水印）布局不变
- `downloadCardPng` / `cardDataFromIds` 不动
- 720×1080 输出尺寸不变
- `CardData` 接口不变

#### 4.1.2 现有六爻的问题

```ts
// imageGen.ts:80-91（现状）
if (isYang) {
  lines.push(
    `<line x1="..." stroke="${C.rice}" stroke-width="14" stroke-linecap="round"/>`,
  );
} else {
  // 阴爻：左右两段断线，gap=12
}
```

- 单一直线 + 圆头，缺乏质感
- 没有任何装饰元素（没有印章感、没有金边、没有纹理）
- 与项目"工笔重彩 + 国风动漫"定位不匹配

#### 4.1.3 新六爻 SVG 设计

**整体思路**：单爻更"厚"，加金色边框 + 米黄填充 + 阴影感，但仍保持极简（不能盖过卦名等文字）。

**阳爻**：

- 矩形条：从中央水平贯穿，宽 220px，高 28px
- 填充：june-bronze 金（`#C89E3A`）
- 描边：ink 深色（`#1A1A1A`），宽 1.5px
- 圆角：rx=4
- 顶部高光线：上半部分叠加一条 alpha 0.25 的 rice 色横线（2px 高），模拟金属反光

**阴爻**：

- 左右两段矩形（gap = 28px，比原 12 拉宽）
- 每段：宽 96px，高 28px
- 同样的金填充 + 深色描边 + 顶部高光

**爻间距离**：

- 六爻纵向间距保持（`lineHeight` 不变）
- 但增加一个非常细微的"爻间暗线"：每爻下方 1px 的 rgba(0,0,0,0.08) 横线，模拟"分爻"的古卷纸感

**动爻标记**：

- 现有逻辑：阳爻变红（已部分实现？需核实）
- 新增：动爻爻位左右各加一个朱砂小圆点（r=3），与右侧卦名"动 · 第 N 爻"对齐

> **动爻标记的具体位置**：builder 实施时若发现现状已用其他方式标识动爻（如颜色变化），则保留现状，仅在爻本体上做"金边 + 高光"升级；若现状无动爻视觉区分，则加朱砂圆点。

#### 4.1.4 实现约束

- **文件长度控制**：`renderCardSvg` 现在 116 行，重写后建议控制在 130 行内。若超过，把六爻 SVG 渲染抽到 `imageGen.hexagram.ts` 子文件，renderCardSvg 内调 `renderHexagramLines(hero)`。
- **测试必须通过**：`tests/lib/imageGen.test.ts` 现有所有断言（`assert svg.includes(...)` 等）继续成立。Builder 实施时若改 SVG 结构影响断言，需同步更新测试。
- **视觉验证**：用实际起卦数据生成 PNG，肉眼检查六爻是否清晰、与整体米黄底色协调。

#### 4.1.5 SVG 渲染代码骨架（供 builder 参考）

```ts
function renderHexagramLines(hero: Hexagram, w: number): string {
  // 抽出 renderCardSvg 内 yBinaryLines/yBinaryEnd/lineHeight 几何参数
  // 返回所有 <g>...</g> 字符串，由 renderCardSvg 嵌入 <g>${lines}</g>
}

// renderCardSvg 内替换 lines 循环：
const lines = renderHexagramLines(hero, W);
```

### 4.2 随机数动画（NumberBoxRandomizer）

#### 4.2.1 组件结构（新目录，不动 NumberBox）

```
src/components/ui/NumberBoxRandomizer/
  index.tsx           ← 入口（组合 NumberBox + 随机按钮 + 动画层）
  RandomizerReel.tsx  ← 老虎机式滚动（默认 variant）
  RandomizerScroll.tsx
  RandomizerStemBranch.tsx
  shared.ts           ← reduced-motion 检测 + 随机终值计算 + 状态机 hook
```

公开组件（DivinationForm 唯一调用方）：

```tsx
interface NumberBoxWithRandomizerProps {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  description?: string;
  variant?: "reel" | "scroll" | "stem-branch"; // 默认 'reel'
  onRandomStart?: () => void;
  onRandomEnd?: (finalValue: number) => void;
  className?: string;
}
```

**内部**：`render <NumberBox .../>` + 右下角叠加 `<RandomizerReel|Scroll|StemBranch />` 按钮 + 动画层。

#### 4.2.2 三种 variant 规格

| variant       | 视觉                                                                       | 时长   | 实现要点                                                         |
| ------------- | -------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------- |
| `reel`        | 三位数字老虎机式滚动，前 800ms 全速随机切换，后 600ms 缓动减速至终值       | 1400ms | framer-motion `useMotionValue` + 每 50ms 切换一个 100-999 随机数 |
| `scroll`      | 一张卷轴从底部升入，三位数字在卷轴上翻动 → 定格 → 卷轴隐去                 | 1600ms | framer-motion AnimatePresence + 卷轴 SVG（沿用 imageGen 风格）   |
| `stem-branch` | 错落闪现天干（甲乙…癸）/ 地支（子丑…亥）/ 卦象符号（⚊⚋），最后定格三位数 | 1700ms | 50ms 一帧切换，随机抽以上三类，结束帧切回阿拉伯数字              |

#### 4.2.3 状态机

```
[ idle ]
  ↓ click 随机按钮
[ randomizing ]
  - input.disabled = true（通过 NumberBox 的 disabled prop）
  - aria-busy = true
  - 启动定时器 + framer-motion
  ↓ animation end
[ settling ]
  - emit onRandomEnd(finalValue)
  - onChange(finalValue)
  - input.disabled = false
  ↓
[ idle ]
```

- **防抖**：randomizing 中再次点击 noop（`useRef<boolean>` 锁）
- **卸载清理**：`useEffect` cleanup 清空 `setTimeout` / `requestAnimationFrame`
- **可访问性**：随机按钮 `type="button"`、`aria-label="随机生成灵数"`；reduced-motion 时所有 variant 立即跳终值（framer-motion `useReducedMotion()` hook）

### 4.3 DivinationForm 提交校验

```ts
// src/lib/validation.ts（新增）
export function buildNumberError(
  numbers: [number | null, number | null, number | null],
): string | null {
  const labels = ["第一灵数", "第二灵数", "第三灵数"];
  const missing: string[] = [];
  numbers.forEach((n, i) => {
    if (n === null || n < 100 || n > 999) missing.push(labels[i]);
  });
  if (missing.length === 0) return null;
  if (missing.length === 3) return "请填写三个灵数（可手动输入或随机生成）";
  return `请填写：${missing.join("、")}`;
}
```

`isValid` 不变（三者均合法三位数）。`handleSubmit` 改用 `setError(buildNumberError(numbers))`。

**测试**：`tests/lib/validation.test.ts` 覆盖五个分支（全 null / 部分缺 / 越界 / 全合法）。

### 4.4 数据流

```
[用户/随机] → NumberBoxWithRandomizer → DivinationForm.numbers
                                          ↓
                                  divination.ts (已有)
                                          ↓
                                  UserRecord (saveRecord)
                                          ↓
                          ┌───────────────┴───────────────┐
                          ↓                               ↓
                   /result/:id                  ResultDisplay.handleDownload
                          ↓                               ↓
                  ResultDisplay (已有)         cardDataFromIds → downloadCardPng
                                                       ↓
                                                  PNG 下载（视觉升级后更精美）
```

## 5. 文件变更清单

### 5.1 新增文件

| 路径                                                             | 用途                                          |
| ---------------------------------------------------------------- | --------------------------------------------- |
| `src/components/ui/NumberBoxRandomizer/index.tsx`                | 组合组件入口                                  |
| `src/components/ui/NumberBoxRandomizer/RandomizerReel.tsx`       | reel 动画                                     |
| `src/components/ui/NumberBoxRandomizer/RandomizerScroll.tsx`     | scroll 动画                                   |
| `src/components/ui/NumberBoxRandomizer/RandomizerStemBranch.tsx` | stem-branch 动画                              |
| `src/components/ui/NumberBoxRandomizer/shared.ts`                | 共享工具（reduced-motion、终值、状态机）      |
| `src/lib/validation.ts`                                          | `buildNumberError` 纯函数                     |
| `tests/lib/validation.test.ts`                                   | validation 单测（5 分支）                     |
| `tests/components/NumberBoxRandomizer.test.tsx`                  | 三 variant + reduced-motion + 防抖            |
| `tests/lib/imageGen.test.ts` 追加                                | 新六爻 SVG 渲染断言（爻宽度、描边、动爻圆点） |

### 5.2 修改文件

| 路径                                         | 改动                                                                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/imageGen.ts`                        | **仅重写六爻 SVG 渲染部分**（renderCardSvg 内的 lines 循环）；外部 API 全部不变                                                                                |
| `src/components/sections/DivinationForm.tsx` | 三处替换：① `NumberBox` → `NumberBoxWithRandomizer`；② DEV-only variant 切换器（`if (import.meta.env.DEV)` 整块包裹）；③ `setError(buildNumberError(numbers))` |

### 5.3 不修改（明确）

- `src/components/ui/NumberBox.tsx`
- `src/lib/storage.ts`
- `src/types/record.ts`
- `src/lib/divination.ts`
- `src/pages/HexagramDetail.tsx`
- `src/pages/Result.tsx` / `src/components/sections/ResultDisplay.tsx`
- worker / functions
- `package.json`（零新依赖）
- `tailwind.config.ts` / `tokens.css`

## 6. 测试策略

### 6.1 单元测试（新增/追加）

- `tests/lib/validation.test.ts`：buildNumberError 五个分支
- `tests/lib/imageGen.test.ts` 追加：
  - 新六爻 SVG 包含 `<rect` 元素（不再是单纯 `<line>`）
  - 阳爻与阴爻结构差异（阴爻有两段 rect）
  - 动爻爻位包含朱砂圆点（`<circle fill="${C.red}"`）
  - 整体卦象视觉快照（若 vitest 配置了 toMatchSnapshot）
- `tests/components/NumberBoxRandomizer.test.tsx`：
  - variant='reel'：mock 定时器 1400ms 后终值在 [100, 999]
  - variant='scroll'：mock 1600ms 后终值合法
  - variant='stem-branch'：mock 1700ms 后终值合法
  - reduced-motion：mock 0ms 立即终值
  - 防抖：randomizing 中再次点击 noop（mock 验证 onChange 只触发一次）
  - 卸载：定时器清理（mock 验证 clearTimeout 被调用）

### 6.2 现有测试不动

- `tests/lib/imageGen.test.ts` 现有断言保持通过；只有 SVG 结构断言需小范围更新

### 6.3 手动验证

- 起卦 → Result → 点"♡ 收藏本卦" → 浏览器下载 → 图片查看器打开 → **肉眼检查新六爻视觉**（是否更精致、是否与米黄底色协调、动爻标记是否清晰）
- DivinationForm 空三格 → 错误提示"请填写三个灵数…"
- DivinationForm 任一格点随机 → 动画 → 终值合法 → 输入框可编辑
- DEV variant 切换：UI 即时变化
- reduced-motion 浏览器：所有 variant 直接跳终态

## 7. 风险与权衡

| 风险                            | 缓解                                                                       |
| ------------------------------- | -------------------------------------------------------------------------- |
| 新六爻 SVG 与现有测试断言冲突   | Builder 实施时同步更新 `imageGen.test.ts` 断言；不要改外部 API             |
| imageGen.ts 文件膨胀            | 若六爻函数超 50 行，抽 `imageGen.hexagram.ts` 子文件                       |
| 三 variant 维护成本             | 拆目录 + 共享 `shared.ts`；统一 props                                      |
| 动爻标记现状不明                | builder 第一步 Read 现有代码确认；若已有动爻视觉，仅升级爻本体，不重复标记 |
| 字体 / 颜色与升级后六爻协调     | 沿用现有 `C` 常量配色 + FONT 栈；视觉验证靠 PNG 肉眼确认                   |
| DEV-only 切换器 prod tree-shake | `if (import.meta.env.DEV)` 整块包裹，非 dev 构建消除                       |

## 8. 评审问题最终回答

| #   | 问题                           | 答案                                           |
| --- | ------------------------------ | ---------------------------------------------- |
| 1   | Result AI 解读是否在 record 里 | 是（v1 评审已闭环）                            |
| 2   | 三 variant 拆子组件            | 拆为 NumberBoxRandomizer/ 目录，不改 NumberBox |
| 3   | html-to-image vs SVG           | SVG（沿用 imageGen.ts），零新依赖              |
| 4   | DEV-only 切换器                | 合理，import.meta.env.DEV 整块包裹             |
| 5   | 错误提示 i18n                  | 硬编码中文                                     |
| 6   | HexagramDetail 次级入口        | 本期不做                                       |
| 7   | 卡片整体重新设计               | **不做**（用户拍板：只调整卦象主体）           |

---

**下一步**：v3 设计稿确认 → 交 builder 实现。
