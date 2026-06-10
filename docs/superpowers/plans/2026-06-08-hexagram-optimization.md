# 卦象优化 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `feat/mvp-implementation` 分支上，按 8 个原子 commit 实施卦象优化（P0 bug/视觉 4 项 + P1 架构/语义/布局/防御 4 项），最终通过 spec §4.4 全部 DoD。

**Architecture:** 按 import 拓扑分 4 层：①Foundation（types/storage/删 Stamp）→ ②共享组件（Seal 增强、新建 MiniYaoStack、NumberBox 修复）→ ③调用方（5 处 Stamp→Seal、Hero 视觉、详情页节奏、YaoLineScroll import、关系 try/catch）→ ④测试（NumberBox 回归）。每层独立 commit，可逐层 revert。

**Tech Stack:** Vite + React 18 + TypeScript + Tailwind + Framer Motion（项目现状）；Vitest + @testing-library/react（测试）；Tailwind tokens（`june-red/bronze/gold/clay/ink/rice`）；framer-motion `motion.div`。

**Spec:** [`docs/superpowers/specs/2026-06-08-hexagram-optimization-design.md`](../specs/2026-06-08-hexagram-optimization-design.md) (v1.0)

**Working directory:** `D:\eight` (git branch: `feat/mvp-implementation`)

**Key files to read first (for context):**
- `src/components/ui/Stamp.tsx` (待删除)
- `src/components/ui/Seal.tsx` (待增强)
- `src/components/ui/NumberBox.tsx` (待修)
- `src/components/hexagram/YaoLineScroll.tsx` (待抽组件)
- `src/pages/HexagramDetail.tsx` (待改 V5/D1/B2)
- `src/components/sections/DailyHero.tsx` (待改 V4/V6)
- `src/components/sections/ResultDisplay.tsx` (待改 V4/V6)
- `src/types/record.ts` (待加 version)
- `src/lib/storage.ts` (待加 migrateRecord)
- `tests/components/Forms.test.tsx` (已有 NumberBox 回归测试，将扩写)

---

## Task 1: B8 — 类型与存储层 (region 注释 + version 字段 + migrateRecord)

**Files:**
- Modify: `src/types/record.ts`
- Modify: `src/lib/storage.ts`
- Modify: `src/components/sections/DivinationForm.tsx`
- Test: `tests/lib/storage.test.ts` (新文件)

这是 Foundation 层，**没有内部依赖**。此 task 完成后，schema 加了 `version: 1` 字段，`storage.ts` 能在加载时自动给老数据打标，`DivinationForm` 写入时也带 version。

- [ ] **Step 1: 写 storage.ts 的 migrateRecord 失败测试**

`tests/lib/storage.test.ts` 还不存在，先建。

```typescript
// tests/lib/storage.test.ts
import { describe, it, expect, beforeEach } from 'vitest'

describe('storage migration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates a v0 record (no version field) by adding version: 1', async () => {
    // 写一条"老" record（无 version）到 localStorage
    const oldRecord = {
      id: 'old-1',
      type: 'three-number',
      createdAt: Date.now(),
      region: 'Asia/Singapore',
      timezone: 'Asia/Singapore',
      mainHexagramId: 1,
      movingLine: 1,
      changedHexagramId: 2,
    }
    localStorage.setItem('zhouyi:records', JSON.stringify([oldRecord]))

    const { getAllRecords } = await import('@/lib/storage')
    const records = getAllRecords()
    expect(records).toHaveLength(1)
    expect(records[0].version).toBe(1)
    expect(records[0].id).toBe('old-1')
  })
})
```

- [ ] **Step 2: 运行测试，验证失败**

Run: `npm test -- storage.test`
Expected: FAIL — `getAllRecords` 不返回 `version` 字段（schema 还没加，TypeScript 也可能抱怨）。

- [ ] **Step 3: 加 `version: 1` 到 UserRecord type**

`src/types/record.ts`，在接口末尾加：

```typescript
export interface UserRecord {
  id: string
  type: 'three-number' | 'daily'
  createdAt: number
  question?: string
  numbers?: [number, number, number]
  /** 时区 (IANA, e.g. 'Asia/Singapore') */
  region: string
  timezone: string
  mainHexagramId: HexagramId
  movingLine: 1 | 2 | 3 | 4 | 5 | 6
  changedHexagramId: HexagramId
  aiInterpretation?: string
  userNote?: string
  /** schema 版本 */
  version: 1
}
```

- [ ] **Step 4: 在 storage.ts 加 migrateRecord 并在 getAllRecords 调用**

`src/lib/storage.ts`，在 `getAllRecords` 之前加私有函数：

```typescript
/** 把 v0 老 record（无 version 字段）补 version: 1。新数据已自带 version 时原样返回。 */
function migrateRecord(raw: unknown): UserRecord {
  if (!raw || typeof raw !== 'object') return raw as UserRecord
  const r = raw as Record<string, unknown>
  if (typeof r.version !== 'number') {
    return { ...r, version: 1 } as UserRecord
  }
  return r as UserRecord
}
```

把 `getAllRecords` 里的循环改为：

```typescript
  for (const item of parsed) {
    if (item && typeof item === 'object' && 'id' in item && 'createdAt' in item) {
      records.push(migrateRecord(item))
    }
  }
```

- [ ] **Step 5: 运行测试，验证通过**

Run: `npm test -- storage.test`
Expected: PASS — 老 record 加载后带 `version: 1`。

- [ ] **Step 6: 在 DivinationForm.tsx saveRecord 调用加 version: 1**

`src/components/sections/DivinationForm.tsx`，找到 `saveRecord({` 调用块，在 `changedHexagramId: result.changedHexagramId,` 之后加一行：

```typescript
      saveRecord({
        id: recordId,
        type: 'three-number',
        createdAt: Date.now(),
        question: question || undefined,
        numbers: [a, b, c],
        region,
        timezone: region,
        mainHexagramId: result.mainHexagramId,
        movingLine: result.movingLine,
        changedHexagramId: result.changedHexagramId,
        version: 1,
      })
```

- [ ] **Step 7: 类型检查通过**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 8: 跑全测试套件，确认无回归**

Run: `npm test`
Expected: 全部 PASS（除 storage 那个新增的）；如有老测试因 `version` 字段缺而失败，先看是否需要更新 mock 数据，**不要改老测试的断言**，而是给 mock 补 `version: 1`。

- [ ] **Step 9: Commit**

```bash
git add src/types/record.ts src/lib/storage.ts src/components/sections/DivinationForm.tsx tests/lib/storage.test.ts
git commit -m "feat(storage): add schema version + migrateRecord (B8)

- UserRecord.version: 1
- migrateRecord() patches v0 records missing version
- DivinationForm writes version: 1
- New storage.test.ts covers migration

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: V4 准备 — Seal 组件加 compact prop

**Files:**
- Modify: `src/components/ui/Seal.tsx`

`Seal.tsx` 当前只接受 `size` 和 `text`。加 `compact?: boolean` 用于 38px 详情页 Hero（不挡爻象），并把字号自适应逻辑提取出来便于阅读。

- [ ] **Step 1: 写 Seal 渲染测试覆盖 compact 与 textColor 接受**

检查 `tests/components/` 是否有 Seal 测试。没有就建：

```typescript
// tests/components/Seal.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Seal } from '@/components/ui/Seal'

describe('Seal', () => {
  it('renders text inside the seal', () => {
    const { container } = render(<Seal text="讼" />)
    expect(container.querySelector('text')?.textContent).toBe('讼')
  })

  it('respects compact prop (smaller text in small seal)', () => {
    const { container: c1 } = render(<Seal text="讼" size={38} />)
    const { container: c2 } = render(<Seal text="讼" size={38} compact />)
    const f1 = c1.querySelector('text')?.getAttribute('font-size')
    const f2 = c2.querySelector('text')?.getAttribute('font-size')
    expect(f1).not.toBe(f2)
  })
})
```

- [ ] **Step 2: 跑测试，验证第二个 case 失败**

Run: `npm test -- Seal.test`
Expected: 第二个 `it` FAIL（`compact` prop 还没实现，font-size 相同）。

- [ ] **Step 3: 改 Seal.tsx 加 compact prop**

```typescript
// src/components/ui/Seal.tsx
import { cn } from '@/utils/cn'

export interface SealProps {
  /** The character(s) to display inside the seal. 1-4 Chinese characters. */
  text: string
  /** Size in pixels (width = height = size). Default 38. */
  size?: number
  /** Rotation angle in degrees. Default 0. */
  rotation?: number
  /** Foreground color (text). Default rice (米色). */
  textColor?: string
  /** Background color. Default june-red (朱砂). */
  bgColor?: string
  /** Force compact text size (32px) regardless of seal size. Use for small seals that overlap content. */
  compact?: boolean
  /** Optional click handler */
  onClick?: () => void
  className?: string
}

export function Seal({
  text,
  size = 38,
  rotation = 0,
  textColor = '#FAF6EC',
  bgColor = '#9b2c2c',
  compact = false,
  onClick,
  className,
}: SealProps) {
  // Compact 模式强制 32px 字号；否则按 size 缩放（44px @ 56, 56px @ 80）
  const fontSize = compact
    ? 32
    : Math.max(Math.round(size * 0.78), 32)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      onClick={onClick}
      role={onClick ? 'button' : 'img'}
      aria-label={text}
      style={{ transform: `rotate(${rotation}deg)`, flexShrink: 0 }}
      className={cn(onClick && 'cursor-pointer', className)}
    >
      {/* Outer square (seal body) — 减负版：去除外黑边 */}
      <rect x="2" y="2" width="96" height="96" fill={bgColor} />
      {/* Inner thin border — "印泥厚薄" depth illusion */}
      <rect
        x="9"
        y="9"
        width="82"
        height="82"
        fill="none"
        stroke={textColor}
        strokeWidth="1"
        opacity="0.5"
      />
      {/* Character(s) */}
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fill={textColor}
        fontFamily="'Noto Serif SC', 'Songti SC', serif"
        fontWeight="500"
        style={{ letterSpacing: '0.05em' }}
      >
        {text}
      </text>
    </svg>
  )
}
```

- [ ] **Step 4: 跑测试，验证通过**

Run: `npm test -- Seal.test`
Expected: 2/2 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Seal.tsx tests/components/Seal.test.tsx
git commit -m "feat(seal): add compact prop + relaxed outer (V4 prep)

- compact prop forces 32px text regardless of seal size
- Default size scales text up (was 0.42*size, now 0.78*size, min 32)
- Removed outer black 3px stroke per 'Seal 减负版' visual decision
- Inner rice-paper border opacity 0.5 (was 0.6)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: B7 准备 — 抽出 MiniYaoStack 独立组件

**Files:**
- Create: `src/components/hexagram/MiniYaoStack.tsx`
- Modify: `src/components/hexagram/YaoLineScroll.tsx` (此 task 只加 import，**不删内部定义**——避免一次性大改；真正删除留到 Task 6)
- Test: `tests/components/MiniYaoStack.test.tsx` (新文件)

`MiniYao` 和 `MiniHexagramStack` 当前在 `YaoLineScroll.tsx` 里内联定义。抽到独立文件便于复用与单测。

- [ ] **Step 1: 写 MiniYaoStack 测试**

```typescript
// tests/components/MiniYaoStack.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MiniYaoStack } from '@/components/hexagram/MiniYaoStack'
import type { YaoLine } from '@/types'

const yaoLines: YaoLine[] = [
  { position: 1, type: 'yang', originalText: '', explanation: '', modernMeaning: '' },
  { position: 2, type: 'yin', originalText: '', explanation: '', modernMeaning: '' },
  { position: 3, type: 'yang', originalText: '', explanation: '', modernMeaning: '' },
  { position: 4, type: 'yin', originalText: '', explanation: '', modernMeaning: '' },
  { position: 5, type: 'yang', originalText: '', explanation: '', modernMeaning: '' },
  { position: 6, type: 'yang', originalText: '', explanation: '', modernMeaning: '' },
]

describe('MiniYaoStack', () => {
  it('renders 6 rows, one per yao position', () => {
    const { container } = render(<MiniYaoStack yaoLines={yaoLines} currentLine={3} />)
    // 6 个 data-position 属性
    const rows = container.querySelectorAll('[data-position]')
    expect(rows).toHaveLength(6)
  })

  it('marks currentLine row with data-current="true"', () => {
    const { container } = render(<MiniYaoStack yaoLines={yaoLines} currentLine={4} />)
    const currentRow = container.querySelector('[data-current="true"]')
    expect(currentRow).not.toBeNull()
    expect(currentRow?.getAttribute('data-position')).toBe('4')
  })

  it('renders rows in 6→1 order (top-down visual, matches card display)', () => {
    const { container } = render(<MiniYaoStack yaoLines={yaoLines} currentLine={1} />)
    const rows = Array.from(container.querySelectorAll('[data-position]'))
    const positions = rows.map((r) => r.getAttribute('data-position'))
    expect(positions).toEqual(['6', '5', '4', '3', '2', '1'])
  })

  it('has accessible label indicating current line', () => {
    render(<MiniYaoStack yaoLines={yaoLines} currentLine={5} />)
    expect(screen.getByLabelText('位置指示器，当前在第 5 爻')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 跑测试，验证失败（模块不存在）**

Run: `npm test -- MiniYaoStack.test`
Expected: FAIL — module not found.

- [ ] **Step 3: 创建 MiniYaoStack.tsx**

从 `YaoLineScroll.tsx` 抽出 `MiniYao` 和 `MiniHexagramStack`，重命名为 `MiniYaoStack`，加 `data-testid="mini-yao-stack"` 便于将来 test 钩子。

```typescript
// src/components/hexagram/MiniYaoStack.tsx
import { cn } from '@/utils/cn'
import type { YaoLine } from '@/types'

export interface MiniYaoStackProps {
  /** The 6 yao lines for this hexagram (position 1-6, bottom-to-top). */
  yaoLines: YaoLine[]
  /** 1-6, which row to highlight as the current one. */
  currentLine: number
  className?: string
}

function MiniYao({ type, isCurrent }: { type: 'yin' | 'yang'; isCurrent: boolean }) {
  const color = isCurrent ? '#9b2c2c' : 'rgba(26,26,26,0.18)'
  const w = 32
  if (type === 'yang') {
    return <div style={{ width: w, height: 6, background: color, borderRadius: 1 }} />
  }
  return (
    <div style={{ display: 'flex', gap: 4, width: w }}>
      <div style={{ width: (w - 4) / 2, height: 6, background: color, borderRadius: 1 }} />
      <div style={{ width: (w - 4) / 2, height: 6, background: color, borderRadius: 1 }} />
    </div>
  )
}

/**
 * 6 爻 mini 堆栈 — 用于 YaoLineScroll / 详情页右侧"当前显示的是哪一爻"的视觉指示。
 * 视觉：6 爻垂直堆叠（6 上 1 下），当前爻红环红底高亮，其他爻灰显 60% 透明。
 */
export function MiniYaoStack({ yaoLines, currentLine, className }: MiniYaoStackProps) {
  return (
    <div
      className={cn(
        'flex flex-col bg-rice/60 border border-june-bronze/30 rounded-md p-2',
        className
      )}
      style={{ gap: 7 }}
      aria-label={`位置指示器，当前在第 ${currentLine} 爻`}
      data-testid="mini-yao-stack"
    >
      {[6, 5, 4, 3, 2, 1].map((pos) => {
        const isCurrent = pos === currentLine
        const yao = yaoLines[pos - 1]
        const type: 'yin' | 'yang' = yao?.type ?? 'yang'
        return (
          <div
            key={pos}
            data-current={isCurrent ? 'true' : 'false'}
            data-position={pos}
            className={cn(
              'flex items-center justify-center rounded-sm transition-all',
              isCurrent
                ? 'bg-june-red/20 ring-2 ring-june-red shadow-sm'
                : 'opacity-60'
            )}
            style={{ padding: '2px 4px' }}
          >
            <MiniYao type={type} isCurrent={isCurrent} />
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: 跑测试，验证通过**

Run: `npm test -- MiniYaoStack.test`
Expected: 4/4 PASS.

- [ ] **Step 5: 跑全测试，确保无回归**

Run: `npm test`
Expected: 全 PASS（YaoLineScroll 还在用内联版本，新组件尚未被引用，不影响）。

- [ ] **Step 6: Commit**

```bash
git add src/components/hexagram/MiniYaoStack.tsx tests/components/MiniYaoStack.test.tsx
git commit -m "feat(hex): extract MiniYaoStack to standalone component (B7 prep)

Pure extraction from YaoLineScroll's inline MiniYao + MiniHexagramStack.
No behavior change. YaoLineScroll still uses its inline version (Task 6
will switch it over and delete the inline copies).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: V4 — 5 处 Stamp→Seal + 删除 Stamp.tsx（原子提交）

**Files:**
- Modify: `src/components/hexagram/HexagramCard.tsx`
- Modify: `src/components/hexagram/TwinSpread.tsx`
- Modify: `src/components/sections/DailyHero.tsx`
- Modify: `src/components/sections/ResultDisplay.tsx`
- Modify: `src/pages/HexagramDetail.tsx`
- Delete: `src/components/ui/Stamp.tsx`
- Modify: `tests/components/Stamp.test.tsx` → 改为 `Seal.test.tsx`（或删除，老测试是 div Stamp 专用）
- Modify: 其他引用 `Stamp` 的测试（grep 一下）

- [ ] **Step 1: grep 列出所有 Stamp 引用方**

Run: `grep -rn "from '@/components/ui/Stamp'\|from \"@/components/ui/Stamp\"" src/ tests/`
Expected: 5 个 src 文件 + 1 个 Stamp.test.tsx。**记录下来**——这就是要改的清单。

- [ ] **Step 2: 改 HexagramCard.tsx**

`src/components/hexagram/HexagramCard.tsx`：
- `import { Stamp } from '@/components/ui/Stamp'` → `import { Seal } from '@/components/ui/Seal'`
- 找 `<Stamp text={hex.shortName} size="sm" rotation={-3} />`，替换为：
  ```tsx
  <Seal text={hex.shortName} size={38} rotation={-3} compact />
  ```

- [ ] **Step 3: 改 TwinSpread.tsx**

`src/components/hexagram/TwinSpread.tsx`：
- `import { Stamp } ...` → `import { Seal } ...`
- 替换两处 `<Stamp ...>`：本卦用 `bgColor="#8b6914"`（赭石区分），变卦用默认 `#9b2c2c`（朱砂）：
  ```tsx
  // 本卦（左）
  <Seal text={leftHex.shortName} size={44} rotation={-3} bgColor="#8b6914" />
  // 变卦（右）
  <Seal text={rightHex.shortName} size={44} rotation={3} />
  ```

- [ ] **Step 4: 改 DailyHero.tsx**

`src/components/sections/DailyHero.tsx`：
- `import { Stamp }` → `import { Seal }`
- `<Stamp text={main.shortName} size="sm" rotation={-3} />` → `<Seal text={main.shortName} size={44} rotation={-3} />`
- **V6 修复：** 删掉底部 `<div className="absolute bottom-4 right-4 text-rice font-display text-2xl tracking-widest">{main.shortName}</div>`（这一行与右上 Seal 字相同，去掉一个）

- [ ] **Step 5: 改 ResultDisplay.tsx**

`src/components/sections/ResultDisplay.tsx`：同 DailyHero 的 Stamp→Seal + V6 删除底部字。

- [ ] **Step 6: 改 HexagramDetail.tsx**

`src/pages/HexagramDetail.tsx`：
- `import { Stamp }` → `import { Seal }`
- `<Stamp text={hexagram.shortName} size="sm" rotation={-3} />` → `<Seal text={hexagram.shortName} size={38} rotation={-3} compact />`

- [ ] **Step 7: 删 Stamp.tsx 和 Stamp.test.tsx**

```bash
rm src/components/ui/Stamp.tsx tests/components/Stamp.test.tsx
```

- [ ] **Step 8: 类型检查 + grep 验证无 Stamp 残留**

Run: `npm run typecheck`
Run: `grep -rn "ui/Stamp\|ui/Stamp'" src/ tests/` — 期望 0 结果

Expected: typecheck 0 errors；grep 0 hits。

- [ ] **Step 9: 跑全测试，确认无回归**

Run: `npm test`
Expected: 全 PASS。

- [ ] **Step 10: Commit**

```bash
git add -A src/components/hexagram/ src/components/sections/ src/pages/HexagramDetail.tsx src/components/ui/Stamp.tsx tests/
git commit -m "refactor: replace 5 div Stamp sites with Seal (V4)

- HexagramCard / TwinSpread / DailyHero / ResultDisplay / HexagramDetail
- TwinSpread distinguishes 本卦 (赭石 #8b6914) from 变卦 (朱砂 #9b2c2c)
- V6 fix: removed redundant bottom-right hex name in Hero (now only
  the Seal carries the name; left-top keeps the '第 N 卦' number tag)
- Deleted src/components/ui/Stamp.tsx + tests/components/Stamp.test.tsx
  (no remaining references)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: V5 + V6 + D1 — 详情页 Hero 阴影、Hero 冗余字、详情页节奏

**Files:**
- Modify: `src/pages/HexagramDetail.tsx`

注：V6 在 `DailyHero` 和 `ResultDisplay` 里**已经**在 Task 4 删过了。本 task 只剩 V5（去 Hero 双层 shadow）和 D1（详情页 6 段节奏分隔）。

- [ ] **Step 1: 写 HexagramDetail 视觉测试（检查无 shadow-lg，section 标签存在）**

新建 `tests/pages/HexagramDetail.test.tsx`（若不存在）：

```typescript
// tests/pages/HexagramDetail.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import HexagramDetail from '@/pages/HexagramDetail'

const renderAt = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/hexagram/${id}`]}>
      <Routes>
        <Route path="/hexagram/:id" element={<HexagramDetail />} />
      </Routes>
    </MemoryRouter>
  )

describe('HexagramDetail Hero card', () => {
  it('does not have shadow-lg on the hero card', () => {
    const { container } = renderAt('1')
    const heroCard = container.querySelector('[data-testid="hero-card"]')
    expect(heroCard).not.toBeNull()
    expect(heroCard?.className).not.toMatch(/shadow-lg/)
  })
})

describe('HexagramDetail section rhythm (D1)', () => {
  it('uses <section> elements with divide-y separators', () => {
    const { container } = renderAt('1')
    const sections = container.querySelectorAll('section')
    expect(sections.length).toBeGreaterThanOrEqual(5)  // 卦辞/彖/象/六爻/现代 至少 5 段
    // 父容器有 divide-y 类，相邻 section 用朱砂细线分隔
    const parentWithDivide = container.querySelector('.divide-y')
    expect(parentWithDivide).not.toBeNull()
  })
})
```

- [ ] **Step 2: 跑测试，验证失败**

Run: `npm test -- HexagramDetail.test`
Expected: FAIL — `data-testid="hero-card"` 不存在；section 没数据属性。

- [ ] **Step 3: 改 HexagramDetail.tsx — V5（去 shadow-lg + 加 data-testid）**

找 Hero 卡片容器：

```tsx
<div className="bg-rice border-2 border-june-bronze p-6 rounded-md shadow-lg w-fit relative">
```

改为：

```tsx
<div
  data-testid="hero-card"
  className="bg-rice border-2 border-june-bronze p-6 rounded-md w-fit relative"
>
```

- [ ] **Step 4: 改 HexagramDetail.tsx — D1（6 段包 <section> + 朱砂细线）**

把原本的 6 段（卦辞/彖/象/六爻/现代/关系）每段用 `<section>` 包裹，相邻 section 之间用朱砂细线分隔。建议结构：

```tsx
<div className="space-y-6 mb-10 divide-y divide-june-red/20">
  {hexagram.judgement && (
    <section className="pt-5 first:pt-0">
      <div className="text-xs text-june-bronze font-display tracking-widest mb-2">卦 辞</div>
      <p className="font-body text-ink leading-relaxed">{hexagram.judgement}</p>
    </section>
  )}
  {hexagram.tuanzhuan && (
    <section className="pt-5">
      <div className="text-xs text-june-bronze font-display tracking-widest mb-2">彖 传</div>
      <p className="font-body text-ink leading-relaxed">{hexagram.tuanzhuan}</p>
    </section>
  )}
  {hexagram.xiangzhuan.daXiang && (
    <section className="pt-5">
      <div className="text-xs text-june-bronze font-display tracking-widest mb-2">象 传</div>
      <p className="font-body text-ink leading-relaxed">{hexagram.xiangzhuan.daXiang}</p>
    </section>
  )}
</div>
```

`<div className="mb-10">` (六爻爻辞标题 + scroll) 同样包 `<section>`；modernInterpretation 段同理；关系 tabs 段同理。

- [ ] **Step 5: 跑测试，验证通过**

Run: `npm test -- HexagramDetail.test`
Expected: PASS。

- [ ] **Step 6: 跑全测试 + typecheck**

Run: `npm test && npm run typecheck`
Expected: 全绿。

- [ ] **Step 7: Commit**

```bash
git add src/pages/HexagramDetail.tsx tests/pages/HexagramDetail.test.tsx
git commit -m "feat(detail): remove Hero shadow-lg + add section rhythm (V5, D1)

- V5: dropped redundant shadow-lg (BreathEffect provides glow)
- D1: 6 sections wrapped in <section>, separated by 1px june-red/20
  divider (divide-y). First section has no top padding. pt-5 between.
- Added data-testid='hero-card' for testability.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: B7 — YaoLineScroll 改用 MiniYaoStack 组件

**Files:**
- Modify: `src/components/hexagram/YaoLineScroll.tsx`
- Modify: `tests/components/YaoLineScroll.test.tsx` (若引用了 `MiniHexagramStack` 内部名)

- [ ] **Step 1: grep 确认 YaoLineScroll 内没有外部引用 `MiniHexagramStack`/`MiniYao`（除了内部用）**

Run: `grep -rn "MiniHexagramStack\|MiniYao" src/components/hexagram/YaoLineScroll.tsx tests/`
Expected: 命中点全部在 YaoLineScroll.tsx 内部定义和调用，**没有跨文件引用**。

- [ ] **Step 2: 改 YaoLineScroll.tsx — 加 import + 删内联**

```tsx
// 在 import 区域加
import { MiniYaoStack } from './MiniYaoStack'

// 删除文件内的 MiniYao 函数和 MiniHexagramStack 函数（约 30 行）
// 把右栏使用处：
//   <MiniHexagramStack yaoLines={yaoLines} currentLine={yao.position} />
// 改为：
//   <MiniYaoStack yaoLines={yaoLines} currentLine={yao.position} />
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck`
Expected: 0 errors。

- [ ] **Step 4: 跑 YaoLineScroll.test.tsx 确认无回归**

Run: `npm test -- YaoLineScroll.test`
Expected: 全 PASS（行为不变）。

- [ ] **Step 5: grep 验证无残留**

Run: `grep -rn "MiniHexagramStack\|function MiniYao" src/components/hexagram/YaoLineScroll.tsx`
Expected: 0 hits。

- [ ] **Step 6: 跑全测试**

Run: `npm test`
Expected: 全绿。

- [ ] **Step 7: Commit**

```bash
git add src/components/hexagram/YaoLineScroll.tsx
git commit -m "refactor(hex): YaoLineScroll uses MiniYaoStack from shared module (B7)

Deleted inline MiniYao + MiniHexagramStack (~30 lines), switched to
the standalone component (added in Task 3). Behavior identical;
visual highlighted row remains red ring + 20% red tint.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: B1 — NumberBox 删末位不清空

**Files:**
- Modify: `src/components/ui/NumberBox.tsx`
- Modify: `tests/components/Forms.test.tsx` (加新回归)

- [ ] **Step 1: 加 NumberBox 删末位回归测试（4 路径）**

`tests/components/Forms.test.tsx`，在 `describe('NumberBox', ...)` 内、`it('strips non-digit...')` 之前加：

```typescript
  // B1 regression: backspacing a valid 3-digit number to 2 digits must NOT
  // clear the field. Old useEffect([value]) synced text to '' when value
  // flipped from 111 to null, eating the user's partial input.
  it('keeps partial 2-digit input visible after backspacing a valid number', () => {
    const handler = vi.fn()
    const { rerender } = render(<NumberBox value={111} onChange={handler} label="t" />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('111')

    // User backspaces: 111 → 11
    fireEvent.change(input, { target: { value: '11' } })
    expect(input.value).toBe('11')
    expect(handler).toHaveBeenLastCalledWith(null)

    // Parent re-renders with value=null (its response to onChange(null))
    rerender(<NumberBox value={null} onChange={handler} label="t" />)
    expect(input.value).toBe('11')  // ← the bug would have cleared this
  })

  it('keeps partial 1-digit input visible after backspacing 2 digits', () => {
    const handler = vi.fn()
    const { rerender } = render(<NumberBox value={123} onChange={handler} label="t" />)
    const input = screen.getByRole('textbox') as HTMLInputElement

    fireEvent.change(input, { target: { value: '1' } })
    expect(input.value).toBe('1')
    rerender(<NumberBox value={null} onChange={handler} label="t" />)
    expect(input.value).toBe('1')
  })

  it('still syncs to empty when parent externally resets', () => {
    const handler = vi.fn()
    const { rerender } = render(<NumberBox value={427} onChange={handler} label="t" />)
    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('427')

    // Parent externally resets to null (e.g., form reset button)
    rerender(<NumberBox value={null} onChange={handler} label="t" />)
    expect(input.value).toBe('')
  })

  it('still syncs to new value when parent externally updates', () => {
    const handler = vi.fn()
    const { rerender } = render(<NumberBox value={427} onChange={handler} label="t" />)
    const input = screen.getByRole('textbox') as HTMLInputElement

    rerender(<NumberBox value={555} onChange={handler} label="t" />)
    expect(input.value).toBe('555')
  })
```

- [ ] **Step 2: 跑测试，验证第一个新 case 失败**

Run: `npm test -- Forms.test`
Expected: 第一个新 case FAIL（当前实现会在 111→11 时清空）。其他 3 个可能也 FAIL。

- [ ] **Step 3: 改 NumberBox.tsx — 用 useRef 跟踪 emit**

`src/components/ui/NumberBox.tsx`，加 import：

```typescript
import { type InputHTMLAttributes, forwardRef, useEffect, useRef, useState } from 'react'
```

修改组件内部：

```typescript
export const NumberBox = forwardRef<HTMLInputElement, NumberBoxProps>(function NumberBox(
  { value, onChange, label, description, className, ...rest },
  ref
) {
  const [text, setText] = useState(value === null ? '' : String(value))
  // Track the value WE last emitted to the parent. Only sync from parent
  // when its value diverges from this (i.e., parent did an external reset).
  const lastEmittedRef = useRef<number | null>(value)

  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      setText(value === null ? '' : String(value))
      lastEmittedRef.current = value
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.replace(/\D/g, '').slice(0, 3)
    setText(next)
    if (next === '') {
      lastEmittedRef.current = null
      onChange(null)
      return
    }
    const num = parseInt(next, 10)
    if (num >= 100 && num <= 999) {
      lastEmittedRef.current = num
      onChange(num)
    } else {
      lastEmittedRef.current = null
      onChange(null)
    }
  }

  // ... 渲染部分保持不变
})
```

- [ ] **Step 4: 跑测试，验证全部通过**

Run: `npm test -- Forms.test`
Expected: 4/4 新 case PASS，老 case 全 PASS。

- [ ] **Step 5: typecheck**

Run: `npm run typecheck`
Expected: 0 errors。

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/NumberBox.tsx tests/components/Forms.test.tsx
git commit -m "fix(numberbox): preserve partial input on backspace (B1)

useEffect([value]) previously overwrote local text whenever parent
flipped value to null (which happens every keystroke below 100).
Now useRef tracks the value WE last emitted; sync from parent
only fires when parent's value diverges from our own emit
(meaning parent did an external reset).

4 regression tests cover:
- 111 → 11 keeps '11' visible
- 123 → 1 keeps '1' visible
- parent externally resets to null → clears (correct)
- parent externally updates to new value → syncs (correct)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: B2 — 关系计算错误处理 (HexagramDetail try/catch)

**Files:**
- Modify: `src/pages/HexagramDetail.tsx`
- Test: `tests/pages/HexagramDetail.test.tsx` (扩写)

- [ ] **Step 1: 扩写 HexagramDetail 测试覆盖错误降级**

`tests/pages/HexagramDetail.test.tsx`，加新 case（需在文件导入 `vi` 用于 mock）：

```typescript
import { describe, it, expect, vi } from 'vitest'

// ... 顶部 import 加：
// vi.mock('@/lib/relations', async () => {
//   const actual = await vi.importActual<typeof import('@/lib/relations')>('@/lib/relations')
//   return {
//     ...actual,
//     getOpposite: vi.fn(() => { throw new Error('simulated data error') }),
//   }
// })
//
// describe('HexagramDetail relation error handling (B2)', () => {
//   it('shows "本卦关系数据缺失" instead of crashing when getOpposite throws', () => {
//     const { container } = renderAt('1')
//     // page should still render (no error boundary triggered)
//     expect(container.textContent).toContain('坎为水') // 乾为天 for id=1
//     // the relation section should show fallback
//     expect(container.textContent).toContain('本卦关系数据缺失')
//   })
// })
```

**注意：** `vi.mock` 的具体位置按 RTL 习惯放在文件最顶部（`import` 之后）。完整代码：

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('@/lib/relations', async () => {
  const actual = await vi.importActual<typeof import('@/lib/relations')>('@/lib/relations')
  return {
    ...actual,
    getOpposite: vi.fn(() => { throw new Error('simulated data error') }),
  }
})

import HexagramDetail from '@/pages/HexagramDetail'

// ... renderAt ...

describe('HexagramDetail relation error handling (B2)', () => {
  it('does not crash; shows fallback message', () => {
    const { container } = renderAt('1')
    // page rendered
    expect(container.textContent).toBeTruthy()
    // fallback visible
    expect(container.textContent).toContain('本卦关系数据缺失')
  })
})
```

- [ ] **Step 2: 跑测试，验证失败（页面崩）**

Run: `npm test -- HexagramDetail.test`
Expected: FAIL — `getOpposite` 抛错时 React 树崩了，container 抛出未捕获异常。

- [ ] **Step 3: 改 HexagramDetail.tsx — useMemo + try/catch**

把现有的关系计算逻辑：

```tsx
const relationId = activeRelation === 'opposite' ? getOpposite(hexagram.id)
  : activeRelation === 'inverse' ? getInverse(hexagram.id)
  : getNuclear(hexagram.id)
const relationHex = getHexagramById(relationId as HexagramId)
```

替换为：

```tsx
const relationResult = useMemo(() => {
  if (!hexagram) return null
  try {
    const id = activeRelation === 'opposite' ? getOpposite(hexagram.id)
      : activeRelation === 'inverse' ? getInverse(hexagram.id)
      : getNuclear(hexagram.id)
    return { ok: true as const, hex: getHexagramById(id as HexagramId) }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : '关系数据缺失' }
  }
}, [hexagram, activeRelation])
```

（顶部加 `import { useMemo } from 'react'`）

把渲染：

```tsx
{relationHex && (
  <div className="mb-10">
    ... 关系 section ...
  </div>
)}
```

替换为：

```tsx
{relationResult?.ok && relationResult.hex && (
  <div className="mb-10">
    ... 关系 section ...（用 relationResult.hex 替代原来的 relationHex）
  </div>
)}
{relationResult && !relationResult.ok && (
  <div className="text-center text-ink-light/60 text-sm py-6">
    本卦关系数据缺失
  </div>
)}
```

- [ ] **Step 4: 跑测试，验证通过**

Run: `npm test -- HexagramDetail.test`
Expected: PASS。

- [ ] **Step 5: typecheck + 全测试**

Run: `npm run typecheck && npm test`
Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
git add src/pages/HexagramDetail.tsx tests/pages/HexagramDetail.test.tsx
git commit -m "feat(detail): graceful relation calc error handling (B2)

Wrap getOpposite/... in useMemo + try/catch. On failure, render a
single-line fallback '本卦关系数据缺失' instead of letting the error
crash the whole page. The lib/relations layer keeps its throw-on-bad-data
behavior (pure functions stay testable).

Test: vi.mock forces getOpposite to throw; page still renders.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final Verification (DoD from spec §4.4)

跑以下命令，全部通过才算完成：

- [ ] **DoD 1：8 项全部在 commit 列表中**

```bash
git log --oneline | head -10
# 至少 8 个 feat/fix/refactor/docs commit，加上之前的 spec commit (9df41e5) 和 fix (e80b165)
```

- [ ] **DoD 2：无 Stamp 残留**

```bash
grep -r "from '@/components/ui/Stamp'" src/ tests/
# 期望：0 结果
```

- [ ] **DoD 3：YaoLineScroll 不含 MiniHexagramStack**

```bash
grep "MiniHexagramStack" src/components/hexagram/YaoLineScroll.tsx
# 期望：0 结果
```

- [ ] **DoD 4：测试全绿 + B1 回归 4 条 pass**

```bash
npm test
# 期望：全部 PASS
```

- [ ] **DoD 5：typecheck 0 错**

```bash
npm run typecheck
# 期望：0 errors
```

- [ ] **DoD 6：6 张关键页截图（桌面 + 移动）保存到 screenshots/after-***

如果有浏览器（`scripts/screenshots.mjs` 可用），运行一次，截 6 张图，文件名 `after-{01..06}-{page}.png`。如果没浏览器自动化，至少手动跑一次 `npm run dev`，用浏览器/截图工具保存 6 张关键页。

- [ ] **DoD 7：起卦 → 详情 流程无控制台错误**

手动：访问 `/divination`，输入 3 个三位数，提交，跳到 `/result/{id}`，点"查看本卦详情"跳到详情页，全程浏览器 DevTools Console 0 错。

- [ ] **DoD 8：migrateRecord 处理老数据**

`npm test -- storage.test`
期望：1/1 PASS（已覆盖）。

- [ ] **最终 commit（如有变更）**

```bash
git status
# 干净工作区 → OK
# 有未提交变更 → commit
git commit -am "chore: post-implementation cleanup"
```

---

**计划结束。8 个 task + 1 个 final verification，每个 task 包含 6-10 个 step，每步 2-5 分钟可完成。**
