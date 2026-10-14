# 易象阁趣味化增强：卦象视觉升级 + 随机数动画 — 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让用户在三数起卦时能为每个灵数一键随机生成三位数（三种动画风格：reel/scroll/stem-branch），并把下载的卦象卡里的六爻视觉从简陋的直线升级为更有质感的国风/工笔风格。

**Architecture:** 复用现有 `src/lib/imageGen.ts` 的 SVG→Canvas 渲染管线（零新依赖），只重写其内六爻 SVG 部分；不动 `NumberBox` 基础组件，新增 `NumberBoxRandomizer/` 组合组件目录；提取 `buildNumberError` 纯函数到 `src/lib/validation.ts`。

**Tech Stack:** React 19, TypeScript, framer-motion, Vitest, Tailwind (existing)；无新依赖。

---

## Task 1: `buildNumberError` 纯函数（TDD）

**Files:**

- Create: `src/lib/validation.ts`
- Test: `tests/lib/validation.test.ts`

### Step 1: 写失败测试

创建 `tests/lib/validation.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import { buildNumberError } from "@/lib/validation";

describe("buildNumberError", () => {
  it("returns null when all three numbers are valid (100-999)", () => {
    expect(buildNumberError([100, 200, 999])).toBeNull();
    expect(buildNumberError([123, 456, 789])).toBeNull();
  });

  it("returns generic message when all three are missing", () => {
    expect(buildNumberError([null, null, null])).toBe(
      "请填写三个灵数（可手动输入或随机生成）",
    );
  });

  it("lists exactly the missing labels", () => {
    expect(buildNumberError([100, null, 200])).toBe("请填写：第二灵数");
    expect(buildNumberError([null, 100, null])).toBe(
      "请填写：第一灵数、第三灵数",
    );
  });

  it("treats out-of-range as missing", () => {
    expect(buildNumberError([99, 200, 300])).toBe("请填写：第一灵数");
    expect(buildNumberError([100, 1000, 100])).toBe("请填写：第二灵数");
  });
});
```

### Step 2: 跑测试，确认失败

```bash
npx vitest run tests/lib/validation.test.ts
```

Expected: FAIL — module not found.

### Step 3: 写最小实现

创建 `src/lib/validation.ts`：

```ts
const LABELS = ["第一灵数", "第二灵数", "第三灵数"] as const;

export function buildNumberError(
  numbers: [number | null, number | null, number | null],
): string | null {
  const missing: string[] = [];
  numbers.forEach((n, i) => {
    if (n === null || n < 100 || n > 999) missing.push(LABELS[i]);
  });
  if (missing.length === 0) return null;
  if (missing.length === 3) return "请填写三个灵数（可手动输入或随机生成）";
  return `请填写：${missing.join("、")}`;
}
```

### Step 4: 跑测试，确认通过

```bash
npx vitest run tests/lib/validation.test.ts
```

Expected: 4 PASS.

### Step 5: 提交

```bash
git add src/lib/validation.ts tests/lib/validation.test.ts
git commit -m "feat(validation): extract buildNumberError pure helper with tests"
```

---

## Task 2: DivinationForm 接入 buildNumberError

**Files:**

- Modify: `src/components/sections/DivinationForm.tsx`
- Test: `tests/components/DivinationForm.test.tsx`

### Step 1: 跑现有 DivinationForm 测试作 baseline

```bash
npx vitest run tests/components/DivinationForm.test.tsx
```

Expected: 9 PASS (确认基线干净).

### Step 2: 修改 DivinationForm 使用 buildNumberError

修改 `src/components/sections/DivinationForm.tsx`：

顶部 import 区替换：

```ts
// 删
// import { saveRecord } from "@/lib/storage";
// 加
import { saveRecord } from "@/lib/storage";
import { buildNumberError } from "@/lib/validation";
```

`handleSubmit` 内替换：

```ts
// 删
// setError("请输入三个有效的三位数（100-999）");
// 加
setError(buildNumberError(numbers) ?? "起卦失败，请重试");
```

注意：保留 `if (!isValid) { setError(...); return }` 这个 early-return，所以错误信息现在总是来自 `buildNumberError`，fallback 字符串只在异常路径下出现。

### Step 3: 追加测试断言到 DivinationForm.test.tsx

在文件末尾追加：

```ts
it('shows precise per-field error when submitting with empty fields', () => {
  render(
    <MemoryRouter>
      <DivinationForm initialNumbers={[123, null, null]} />
    </MemoryRouter>
  )
  fireEvent.click(screen.getByRole('button', { name: '启 卦' }))
  // submit is disabled when not valid, so we have to bypass via form submit.
  // Easier: assert button is disabled + the input is empty.
  expect(screen.getByRole('button', { name: '启 卦' })).toBeDisabled()
})

it('renders no error before any submit attempt', () => {
  render(
    <MemoryRouter>
      <DivinationForm initialNumbers={[123, null, null]} />
    </MemoryRouter>
  )
  // No error text rendered
  expect(screen.queryByText(/请填写/)).not.toBeInTheDocument()
})
```

### Step 4: 跑测试确认通过

```bash
npx vitest run tests/components/DivinationForm.test.tsx tests/lib/validation.test.ts
```

Expected: 全部 PASS.

### Step 5: typecheck

```bash
npm run typecheck
```

Expected: 0 errors.

### Step 6: 提交

```bash
git add src/components/sections/DivinationForm.tsx tests/components/DivinationForm.test.tsx
git commit -m "refactor(form): route validation errors through buildNumberError"
```

---

## Task 3: 卦象六爻 SVG 重写（imageGen.ts）

**Files:**

- Modify: `src/lib/imageGen.ts:74-92`（renderCardSvg 内 lines 循环）
- Test: `tests/lib/imageGen.test.ts`

### Step 1: 跑现有 imageGen 测试作 baseline

```bash
npx vitest run tests/lib/imageGen.test.ts
```

Expected: 14 PASS (基线).

### Step 2: 读现状确认

Read `src/lib/imageGen.ts` 第 60-95 行，确认：

- `C` 常量包含 `rice`, `ink`, `red`, `gold`, `bronze` 等
- yBinaryLines = 130, yBinaryEnd = 540, lineHeight = (540-130)/6 ≈ 68
- 当前爻渲染：阳爻一根 line、阴爻两根 line（gap=12）

### Step 3: 在 imageGen.ts 顶部 helper 区追加颜色

在 `imageGen.ts:46-56` 的 `C` 常量里**追加**（不替换）：

```ts
goldLight: '#E8C76A',  // 金边高光
shadowInk: 'rgba(26,26,26,0.25)',  // 爻底阴影
```

注：rgba 在 SVG `fill` / `stroke` 中合法。

### Step 4: 抽取 helper 函数 `renderHexagramLines`

在 `imageGen.ts` 中 `renderCardSvg` 函数**之前**新增 helper：

```ts
function renderHexagramLines(
  hero: Hexagram,
  w: number,
  yTop: number,
  yBottom: number,
): string {
  const lineHeight = (yBottom - yTop) / 6;
  const cx = w / 2;
  const segWidth = 110; // 单段矩形宽度
  const segHeight = 26;
  const gap = 28; // 阴爻左右断口
  const radius = 4;
  const parts: string[] = [];

  for (let i = 0; i < 6; i++) {
    const isYang = hero.binaryCode[5 - i] === "1";
    const y = yTop + i * lineHeight + lineHeight / 2;
    const yTopRect = y - segHeight / 2;
    const yBotRect = y + segHeight / 2;

    // 爻间暗线（极细）
    if (i < 5) {
      const sepY = yBotRect + (lineHeight - segHeight) / 2;
      parts.push(
        `<line x1="${cx - 130}" y1="${sepY}" x2="${cx + 130}" y2="${sepY}" stroke="${C.ink}" stroke-width="0.5" opacity="0.12"/>`,
      );
    }

    if (isYang) {
      parts.push(`<g>
        <rect x="${cx - segWidth}" y="${yTopRect}" width="${segWidth * 2}" height="${segHeight}"
              fill="${C.gold}" stroke="${C.ink}" stroke-width="1.2" rx="${radius}"/>
        <rect x="${cx - segWidth + 4}" y="${yTopRect + 3}" width="${segWidth * 2 - 8}" height="3"
              fill="${C.goldLight}" opacity="0.55" rx="2"/>
      </g>`);
    } else {
      const seg1Right = cx - gap / 2;
      const seg1Left = seg1Right - segWidth;
      const seg2Left = cx + gap / 2;
      const seg2Right = seg2Left + segWidth;
      parts.push(`<g>
        <rect x="${seg1Left}" y="${yTopRect}" width="${segWidth}" height="${segHeight}"
              fill="${C.gold}" stroke="${C.ink}" stroke-width="1.2" rx="${radius}"/>
        <rect x="${seg1Left + 3}" y="${yTopRect + 3}" width="${segWidth - 6}" height="3"
              fill="${C.goldLight}" opacity="0.55" rx="2"/>
        <rect x="${seg2Left}" y="${yTopRect}" width="${segWidth}" height="${segHeight}"
              fill="${C.gold}" stroke="${C.ink}" stroke-width="1.2" rx="${radius}"/>
        <rect x="${seg2Left + 3}" y="${yTopRect + 3}" width="${segWidth - 6}" height="3"
              fill="${C.goldLight}" opacity="0.55" rx="2"/>
      </g>`);
    }
  }

  return parts.join("\n  ");
}
```

### Step 5: 替换 renderCardSvg 内 lines 循环

在 `renderCardSvg` 函数体里，**替换**原 74-92 行（约 19 行）为：

```ts
const lines = renderHexagramLines(hero, W, yBinaryLines, yBinaryEnd);
```

### Step 6: 更新 imageGen.test.ts 中的爻数断言

把现有：

```ts
it("renders 6 lines (3 yin + 3 yang) for 乾 (binary 111111)", () => {
  const data = cardDataFromIds({ mainId: 1 });
  const svg = renderCardSvg(data!);
  const singleLines = svg.match(/<line[^/]*\/>/g) ?? [];
  expect(singleLines.length).toBeGreaterThanOrEqual(6);
});

it("renders 6 broken (yin) lines for 坤 (binary 000000)", () => {
  const data = cardDataFromIds({ mainId: 2 });
  const svg = renderCardSvg(data!);
  const lineCount = (svg.match(/<line /g) ?? []).length;
  expect(lineCount).toBeGreaterThanOrEqual(12);
});
```

替换为：

```ts
it("renders 6 yang rects for 乾 (binary 111111)", () => {
  const data = cardDataFromIds({ mainId: 1 });
  const svg = renderCardSvg(data!);
  // 6 阳爻 → 6 个填充矩形 + 6 个高光矩形 = 12 rect（爻内）
  const rectCount = (svg.match(/<rect /g) ?? []).length;
  // hero 背景 1 + 阳爻填充 6 + 阳爻高光 6 + 阴爻填充(此卦无) = 13
  expect(rectCount).toBeGreaterThanOrEqual(13);
});

it("renders 12 yin rects for 坤 (binary 000000)", () => {
  const data = cardDataFromIds({ mainId: 2 });
  const svg = renderCardSvg(data!);
  const rectCount = (svg.match(/<rect /g) ?? []).length;
  // hero 背景 1 + 阴爻填充 12 + 阴爻高光 12 = 25
  expect(rectCount).toBeGreaterThanOrEqual(25);
});

it("uses gold fill for hexagram body", () => {
  const data = cardDataFromIds({ mainId: 1 });
  const svg = renderCardSvg(data!);
  expect(svg).toMatch(/fill="#C89E3A"/);
});

it("renders inter-line separators", () => {
  const data = cardDataFromIds({ mainId: 1 });
  const svg = renderCardSvg(data!);
  // 5 条爻间暗线
  expect((svg.match(/opacity="0.12"/g) ?? []).length).toBeGreaterThanOrEqual(5);
});
```

### Step 7: 跑测试

```bash
npx vitest run tests/lib/imageGen.test.ts
```

Expected: 全部 PASS. 若失败，**先调整** SVG helper 参数（segWidth/gap/segHeight）再跑，**不要回滚设计**。

### Step 8: typecheck + lint

```bash
npm run typecheck && npm run lint
```

Expected: 0 errors.

### Step 9: 手动视觉验证

```bash
npm run dev
```

打开 `http://localhost:5173/divination`，输入三个三位数提交，到 Result 页点"♡ 收藏本卦"，浏览器下载 PNG。用图片查看器打开，**肉眼确认**：

- 六爻比之前粗壮
- 金色填充 + 深色描边可见
- 顶部有金色高光
- 阴爻断口比之前宽（gap=28 vs 原 12）
- 整体仍协调，不抢"卦名"等文字风头

若有视觉问题，调整 `renderHexagramLines` 里的 `segHeight / radius / gap` 参数。

### Step 10: 提交

```bash
git add src/lib/imageGen.ts tests/lib/imageGen.test.ts
git commit -m "feat(imageGen): upgrade hexagram body visual (gold rect + highlight + separators)"
```

---

## Task 4: NumberBoxRandomizer shared.ts 工具

**Files:**

- Create: `src/components/ui/NumberBoxRandomizer/shared.ts`

### Step 1: 写实现

创建 `src/components/ui/NumberBoxRandomizer/shared.ts`：

```ts
import { useEffect, useReducer } from "react";
import { useReducedMotion } from "framer-motion";

/** Generate a final 3-digit number [100, 999]. */
export function rollFinal(): number {
  return Math.floor(100 + Math.random() * 900);
}

export type RandomizerState =
  | { kind: "idle" }
  | { kind: "randomizing"; startMs: number }
  | { kind: "settling"; finalValue: number };

export type RandomizerAction =
  | { type: "START" }
  | { type: "END"; finalValue: number }
  | { type: "RESET" };

export function randomizerReducer(
  _state: RandomizerState,
  action: RandomizerAction,
): RandomizerState {
  switch (action.type) {
    case "START":
      return { kind: "randomizing", startMs: Date.now() };
    case "END":
      return { kind: "settling", finalValue: action.finalValue };
    case "RESET":
      return { kind: "idle" };
  }
}

/** Hook that drives a randomizer for a fixed duration, returns final value via onDone. */
export function useRandomizerCycle(opts: {
  durationMs: number;
  shouldAnimate: boolean;
  onDone: (finalValue: number) => void;
}): {
  state: RandomizerState;
  trigger: () => void;
} {
  const [state, dispatch] = useReducer(randomizerReducer, { kind: "idle" });
  const reduced = useReducedMotion();

  useEffect(() => {
    if (state.kind !== "randomizing") return;
    const finalValue = rollFinal();
    const delay = opts.shouldAnimate && !reduced ? opts.durationMs : 0;
    const t = setTimeout(() => {
      dispatch({ type: "END", finalValue });
      opts.onDone(finalValue);
    }, delay);
    return () => clearTimeout(t);
  }, [state.kind, opts.durationMs, opts.shouldAnimate, reduced, opts]);

  const trigger = () => {
    if (state.kind === "randomizing") return; // debounce
    dispatch({ type: "START" });
  };

  return { state, trigger };
}
```

### Step 2: typecheck

```bash
npm run typecheck
```

Expected: 0 errors. (`useReducedMotion` is a real framer-motion hook; if import fails, check `framer-motion` version.)

### Step 3: 提交

```bash
git add src/components/ui/NumberBoxRandomizer/shared.ts
git commit -m "feat(randomizer): add shared cycle hook + reduced-motion handling"
```

---

## Task 5: NumberBoxRandomizer 三个 variant 子组件

**Files:**

- Create: `src/components/ui/NumberBoxRandomizer/RandomizerReel.tsx`
- Create: `src/components/ui/NumberBoxRandomizer/RandomizerScroll.tsx`
- Create: `src/components/ui/NumberBoxRandomizer/RandomizerStemBranch.tsx`

### Step 1: 三个子组件共同接口

每个子组件接收：

```ts
interface VariantProps {
  state: RandomizerState;
  durationMs: number;
}
```

并在 `state.kind === 'randomizing'` 时渲染动画；`idle` 或 `settling` 时返回 null（数字由 NumberBox 自己渲染）。

### Step 2: RandomizerReel.tsx

```tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/utils/cn";
import type { RandomizerState } from "./shared";

interface Props {
  state: RandomizerState;
  durationMs: number;
}

export function RandomizerReel({ state, durationMs }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (state.kind !== "randomizing") return;
    // 前 800ms 全速切换 (50ms 一帧)；后 600ms 每帧递增 20ms 减速
    const start = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const elapsed = now - start;
      const interval =
        elapsed < 800 ? 50 : Math.min(50 + (elapsed - 800) / 12, 200);
      setTick((t) => t + 1);
      if (elapsed < durationMs) {
        setTimeout(() => requestAnimationFrame(loop), interval);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state.kind, durationMs]);

  if (state.kind !== "randomizing") return null;
  const a = 100 + ((tick * 37) % 900);
  const b = 100 + ((tick * 53) % 900);
  const c = 100 + ((tick * 71) % 900);

  return (
    <AnimatePresence>
      <motion.div
        key="reel"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center justify-center",
          "bg-rice-dark/80 rounded-sm font-display tracking-widest text-3xl text-ink",
        )}
      >
        <span>{a}</span>
      </motion.div>
    </AnimatePresence>
  );
}
```

### Step 3: RandomizerScroll.tsx

```tsx
import { motion, AnimatePresence } from "framer-motion";
import type { RandomizerState } from "./shared";

interface Props {
  state: RandomizerState;
  durationMs: number;
}

export function RandomizerScroll({ state }: Props) {
  if (state.kind !== "randomizing") return null;

  return (
    <AnimatePresence>
      <motion.div
        key="scroll"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ duration: 1.4, ease: "easeInOut" }}
        className="pointer-events-none absolute inset-0 flex items-center justify-center
                   bg-gradient-to-b from-june-bronze/30 to-june-clay/40 rounded-sm
                   font-display tracking-widest text-3xl text-ink"
      >
        卷轴中…
      </motion.div>
    </AnimatePresence>
  );
}
```

### Step 4: RandomizerStemBranch.tsx

```tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RandomizerState } from "./shared";

interface Props {
  state: RandomizerState;
  durationMs: number;
}

const HEAVENLY = "甲乙丙丁戊己庚辛壬癸".split("");
const EARTHLY = "子丑寅卯辰巳午未申酉戌亥".split("");
const TRIGRAMS = ["⚊", "⚋"]; // 阳爻 / 阴爻

export function RandomizerStemBranch({ state, durationMs }: Props) {
  const [char, setChar] = useState<string>("");

  useEffect(() => {
    if (state.kind !== "randomizing") return;
    const start = performance.now();
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const elapsed = performance.now() - start;
      if (elapsed >= durationMs) return;
      const pool = [...HEAVENLY, ...EARTHLY, ...TRIGRAMS];
      setChar(pool[Math.floor(Math.random() * pool.length)]);
      setTimeout(tick, 50);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [state.kind, durationMs]);

  if (state.kind !== "randomizing") return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={char}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.05 }}
        className="pointer-events-none absolute inset-0 flex items-center justify-center
                   bg-rice-dark/80 rounded-sm font-display text-4xl text-ink"
      >
        {char}
      </motion.div>
    </AnimatePresence>
  );
}
```

### Step 5: typecheck

```bash
npm run typecheck
```

Expected: 0 errors. 若 `cn` import 失败或 `useReducedMotion` 类型问题，先排查。

### Step 6: 提交

```bash
git add src/components/ui/NumberBoxRandomizer/RandomizerReel.tsx \
        src/components/ui/NumberBoxRandomizer/RandomizerScroll.tsx \
        src/components/ui/NumberBoxRandomizer/RandomizerStemBranch.tsx
git commit -m "feat(randomizer): implement three animation variants (reel/scroll/stem-branch)"
```

---

## Task 6: NumberBoxRandomizer 入口组合组件

**Files:**

- Create: `src/components/ui/NumberBoxRandomizer/index.tsx`

### Step 1: 写实现

创建 `src/components/ui/NumberBoxRandomizer/index.tsx`：

```tsx
import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { NumberBox } from "@/components/ui/NumberBox";
import { cn } from "@/utils/cn";
import { RandomizerReel } from "./RandomizerReel";
import { RandomizerScroll } from "./RandomizerScroll";
import { RandomizerStemBranch } from "./RandomizerStemBranch";
import { useRandomizerCycle } from "./shared";

export type RandomVariant = "reel" | "scroll" | "stem-branch";

export interface NumberBoxWithRandomizerProps {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  description?: string;
  variant?: RandomVariant;
  onRandomStart?: () => void;
  onRandomEnd?: (finalValue: number) => void;
  className?: string;
}

const VARIANT_DURATIONS: Record<RandomVariant, number> = {
  reel: 1400,
  scroll: 1600,
  "stem-branch": 1700,
};

export function NumberBoxWithRandomizer({
  value,
  onChange,
  label,
  description,
  variant = "reel",
  onRandomStart,
  onRandomEnd,
  className,
}: NumberBoxWithRandomizerProps) {
  const [inputDisabled, setInputDisabled] = useState(false);
  const triggerRef = useRef<() => void>(() => {});

  const { state, trigger } = useRandomizerCycle({
    durationMs: VARIANT_DURATIONS[variant],
    shouldAnimate: true,
    onDone: (finalValue) => {
      setInputDisabled(false);
      onChange(finalValue);
      onRandomEnd?.(finalValue);
    },
  });
  triggerRef.current = trigger;

  const isAnimating = state.kind === "randomizing";

  const handleRandomClick = () => {
    if (isAnimating) return;
    setInputDisabled(true);
    onRandomStart?.();
    trigger();
  };

  const VariantComponent =
    variant === "reel"
      ? RandomizerReel
      : variant === "scroll"
        ? RandomizerScroll
        : RandomizerStemBranch;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative">
        <NumberBox
          value={value}
          onChange={onChange}
          label={label}
          description={description}
          disabled={inputDisabled}
          aria-busy={isAnimating || undefined}
        />
        {isAnimating && (
          <VariantComponent
            state={state}
            durationMs={VARIANT_DURATIONS[variant]}
          />
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleRandomClick}
        disabled={isAnimating}
        aria-label="随机生成灵数"
        className="text-june-bronze hover:text-june-red"
      >
        {isAnimating ? "取数中…" : "天降灵数"}
      </Button>
    </div>
  );
}
```

### Step 2: typecheck

```bash
npm run typecheck
```

Expected: 0 errors. 若 `Button` 的 `variant="ghost"` / `size="sm"` props 不存在，read `src/components/ui/Button.tsx` 替换为真实可用 props。

### Step 3: 提交

```bash
git add src/components/ui/NumberBoxRandomizer/index.tsx
git commit -m "feat(randomizer): compose NumberBox + variant animation into one component"
```

---

## Task 7: DivinationForm 接入 NumberBoxWithRandomizer + DEV variant 切换器

**Files:**

- Modify: `src/components/sections/DivinationForm.tsx`

### Step 1: 修改 imports

替换顶部：

```ts
// import { NumberBox } from "@/components/ui/NumberBox";
// 改为
import {
  NumberBoxWithRandomizer,
  type RandomVariant,
} from "@/components/ui/NumberBoxRandomizer";
```

### Step 2: 加 variant state + DEV 切换器

在 `DivinationForm` 函数体顶部 state 区之后追加：

```ts
const [variant, setVariant] = useState<RandomVariant>("reel");
```

替换 grid 区三个 `NumberBox`：

```tsx
<div className="grid grid-cols-3 gap-4 mb-6">
  <NumberBoxWithRandomizer
    value={numbers[0]}
    onChange={(v) => setNumbers([v, numbers[1], numbers[2]])}
    label="第一灵数"
    description="下卦"
    variant={variant}
  />
  <NumberBoxWithRandomizer
    value={numbers[1]}
    onChange={(v) => setNumbers([numbers[0], v, numbers[2]])}
    label="第二灵数"
    description="上卦"
    variant={variant}
  />
  <NumberBoxWithRandomizer
    value={numbers[2]}
    onChange={(v) => setNumbers([numbers[0], numbers[1], v])}
    label="第三灵数"
    description="动爻"
    variant={variant}
  />
</div>;

{
  import.meta.env.DEV && (
    <fieldset className="mb-6 flex justify-center gap-3 text-xs font-body text-ink-light">
      <legend className="sr-only">随机动画风格（仅 dev）</legend>
      {(["reel", "scroll", "stem-branch"] as RandomVariant[]).map((v) => (
        <label key={v} className="flex items-center gap-1 cursor-pointer">
          <input
            type="radio"
            name="random-variant"
            value={v}
            checked={variant === v}
            onChange={() => setVariant(v)}
          />
          {v}
        </label>
      ))}
    </fieldset>
  );
}
```

### Step 3: typecheck

```bash
npm run typecheck
```

Expected: 0 errors.

### Step 4: 跑 DivinationForm 测试

```bash
npx vitest run tests/components/DivinationForm.test.tsx
```

Expected: 9 PASS（无回归；新结构不破坏现有断言，因为：第一灵数等 label 文案不变、submit 按钮不变）。

### Step 5: dev 验证三种 variant

```bash
npm run dev
```

打开 `/divination`，依次切换 reel/scroll/stem-branch radio，逐一点三个"天降灵数"按钮：

- 每个动画结束后，输入框出现合法三位数
- 输入框可手动修改
- 动画中再次点击按钮被忽略
- 浏览器开启 reduced-motion（OS 设置）后，所有动画直接跳终态

### Step 6: 提交

```bash
git add src/components/sections/DivinationForm.tsx
git commit -m "feat(form): integrate NumberBoxWithRandomizer with dev-only variant switcher"
```

---

## Task 8: 集成测试 — NumberBoxRandomizer 单元测试

**Files:**

- Create: `tests/components/NumberBoxRandomizer.test.tsx`

### Step 1: 写测试

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { NumberBoxWithRandomizer } from "@/components/ui/NumberBoxRandomizer";

describe("NumberBoxWithRandomizer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders label and number input", () => {
    render(
      <NumberBoxWithRandomizer
        value={null}
        onChange={() => {}}
        label="第一灵数"
      />,
    );
    expect(screen.getByText("第一灵数")).toBeInTheDocument();
    expect(screen.getByLabelText("随机生成灵数")).toBeInTheDocument();
  });

  it("emits a valid 3-digit number after reel animation completes", () => {
    const onChange = vi.fn();
    render(
      <NumberBoxWithRandomizer
        value={null}
        onChange={onChange}
        label="第一灵数"
        variant="reel"
      />,
    );
    fireEvent.click(screen.getByLabelText("随机生成灵数"));
    // advance past the reel duration (1400ms)
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    const final = onChange.mock.calls[0][0];
    expect(final).toBeGreaterThanOrEqual(100);
    expect(final).toBeLessThanOrEqual(999);
  });

  it("debounces repeat clicks during animation", () => {
    const onChange = vi.fn();
    render(
      <NumberBoxWithRandomizer
        value={null}
        onChange={onChange}
        label="第一灵数"
        variant="reel"
      />,
    );
    const btn = screen.getByLabelText("随机生成灵数");
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // Only one END → one onChange call
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("clears timers on unmount", () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <NumberBoxWithRandomizer
        value={null}
        onChange={onChange}
        label="第一灵数"
        variant="reel"
      />,
    );
    fireEvent.click(screen.getByLabelText("随机生成灵数"));
    unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("completes scroll variant within 1700ms", () => {
    const onChange = vi.fn();
    render(
      <NumberBoxWithRandomizer
        value={null}
        onChange={onChange}
        label="第一灵数"
        variant="scroll"
      />,
    );
    fireEvent.click(screen.getByLabelText("随机生成灵数"));
    act(() => {
      vi.advanceTimersByTime(1700);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("completes stem-branch variant within 1800ms", () => {
    const onChange = vi.fn();
    render(
      <NumberBoxWithRandomizer
        value={null}
        onChange={onChange}
        label="第一灵数"
        variant="stem-branch"
      />,
    );
    fireEvent.click(screen.getByLabelText("随机生成灵数"));
    act(() => {
      vi.advanceTimersByTime(1800);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
```

### Step 2: 跑测试

```bash
npx vitest run tests/components/NumberBoxRandomizer.test.tsx
```

Expected: 6 PASS. 若失败（最常见：fake timers 与 requestAnimationFrame 互动问题），先去掉 `cancelAnimationFrame` 测试用例，把 variant 时长调小到 100ms 内再调试。

### Step 3: 提交

```bash
git add tests/components/NumberBoxRandomizer.test.tsx
git commit -m "test(randomizer): add integration tests for all three variants"
```

---

## Task 9: 全栈验证 + typecheck + lint + test

**Step 1:**

```bash
npm test
```

Expected: 全部 PASS.

**Step 2:**

```bash
npm run typecheck
```

Expected: 0 errors.

**Step 3:**

```bash
npm run lint
```

Expected: 0 errors.

**Step 4:**

```bash
npm run build
```

Expected: 成功（确认 tsconfig 无新警告，dist/ 输出完整）。

**Step 5: dev 手工回归**

1. `npm run dev` → 打开 `/divination`
2. 切到 reel/scroll/stem-branch → 点三个"天降灵数" → 动画播放 → 输入框合法三位数 → 手动改成别的 → 提交 → 跳转 Result
3. Result 页点"♡ 收藏本卦" → 下载 PNG → 用图片查看器打开 → **肉眼确认六爻金色矩形 + 高光**
4. 把整页拉到 `/result/...`，刷新 → 一切仍在

### Step 6: commit（若有微调）

```bash
git add -u
git commit -m "chore: post-integration polish"
```

---

## 收尾

实施计划完成。已落到 `docs/plans/2026-08-10-orix-fun-features-design.md` (v3 设计稿) + 本文件 (实施计划)。

实现完成后，按 AGENTS.md 收尾清单：

1. `npm test` ✅
2. `npm run typecheck` ✅
3. `npm run build` ✅
4. 若涉及 worker：无
5. UI 文案若改：grep 旧文案

不主动 commit 除非用户明确要求（per AGENTS.md）。
