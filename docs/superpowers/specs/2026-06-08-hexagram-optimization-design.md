# 卦象优化 · 设计规格

**版本：** 1.0
**日期：** 2026-06-08
**状态：** Draft — 待用户复审
**分支：** feat/mvp-implementation
**前置 spec：** [2026-06-02-zhouyi-website-design.md](./2026-06-02-zhouyi-website-design.md) (v1.0)

> 本 spec 是 `2026-06-02` 主设计稿的**实施级补丁**，不修改主设计稿的视觉决策与产品决策，只对 8 个具体改动（4 个 P0 视觉/bug、3 个 P1 架构/语义、1 个 P1 布局）落地定义。

---

## 一、目标与范围

### 1.1 目标

在保持 64 卦数据、起卦算法、视觉风格不动的前提下：
1. 修复合并的 P0 + P1 列表（8 项）
2. 统一印章组件（`Stamp` → `Seal`）
3. 抽出可复用的 `MiniYaoStack` 组件
4. 修正 `region` 字段注释与 schema 版本机制

### 1.2 范围（8 项）

| ID | 标题 | 类型 | 失败条件 |
|---|---|---|---|
| B1 | NumberBox 删末位不清空 | bug | 在 `NumberBox` 输入 123 后回退到 12/1/空，field 不被清空 |
| V4 | 印章统一为 Seal 减负版 | 重构 | 5 处 div Stamp 全部替换为新 `Seal` 组件；`Stamp.tsx` 删除 |
| V5 | Hero 卡片去除双层 shadow | 视觉 | `HexagramDetail` Hero 卡只有一层阴影 |
| V6 | Hero 红渐变块去除三处同字 | 视觉 | `DailyHero` / `ResultDisplay` Hero 只保留一个"卦名"视觉焦点 |
| B7 | 合并 Mini 堆栈与 `YaoLineStack` | 重构 | `MiniYao` / `MiniHexagramStack` 抽到 `MiniYaoStack.tsx`；`YaoLineScroll` 改 import |
| B8 | `region` / `timezone` 字段语义分离 | 数据 | `UserRecord.region` 注释修正为"时区 IANA"；schema 加 `version: 1`；`migrateRecord` 处理老数据 |
| D1 | 详情页节奏 | 视觉/布局 | 6 段（hero/卦辞/彖/象/六爻/现代/关系）用 `<section>` + 朱砂细线分隔 |
| B2 | 关系计算错误处理 | 防御 | `getOpposite/...` 抛错时降级到"本卦关系数据缺失"提示，不崩页 |

### 1.3 非范围

明确**不做**：
- 64 卦数据 (`hexagrams.json`)
- 起卦算法 (`divination.ts` / `daily.ts` / `relations.ts` 行为不变)
- 路由层 (`App.tsx` / 各 page 入口)
- AI 集成 (`ai.ts` / 后端)
- P2 全部（`RelationTabs` 死代码、hexagrams.json 懒加载、`▎释/今` 装饰符、关系 tab 单页改对开页）

---

## 二、文件改动清单（按 import 拓扑排序）

### 2.1 Foundation / 类型层

| 文件 | 操作 | 改动 |
|---|---|---|
| `src/types/record.ts` | 改 | `region` 字段注释改为"时区 (IANA, e.g. 'Asia/Singapore')"；新增 `version: 1` 必填字段 |
| `src/lib/storage.ts` | 改 | 新增 `migrateRecord(raw)` 私有函数；`getAllRecords` 内调用迁移 |
| `src/components/ui/Stamp.tsx` | **删** | 全文被替换为 `Seal`，0 引用 |

### 2.2 共享组件层

| 文件 | 操作 | 改动 |
|---|---|---|
| `src/components/ui/Seal.tsx` | 改 | 加 `compact?: boolean` prop（用于 38px sm 卡，字号自适应 38px→32）；接受 1-4 字文本 |
| `src/components/hexagram/MiniYaoStack.tsx` | **新建** | 抽出 `MiniYao` + `MiniHexagramStack`；保持现有视觉（红环红底高亮当前爻）；导出 `MiniYaoStack` 组件 |
| `src/components/ui/NumberBox.tsx` | 改 | B1 修复：用 `useRef` 跟踪前次 emit 的值，typing 过程中不回写 text |

### 2.3 调用方（依赖 2.2）

| 文件 | 操作 | 改动 |
|---|---|---|
| `src/components/hexagram/HexagramCard.tsx` | 改 | `import { Stamp }` → `import { Seal }`；`Stamp` 调用换 `Seal`；sm 卡不挂 stamp（保持 `showStamp` 默认行为） |
| `src/components/hexagram/TwinSpread.tsx` | 改 | 同上 |
| `src/components/hexagram/YaoLineScroll.tsx` | 改 | 删除内部 `MiniYao` / `MiniHexagramStack` 定义；改为 `import { MiniYaoStack }` |
| `src/components/sections/DailyHero.tsx` | 改 | ① Stamp→Seal；② V6 修复：删除"右下大字卦名"（保留右上 stamp + 左上"第 N 卦"标号） |
| `src/components/sections/ResultDisplay.tsx` | 改 | ① Stamp→Seal；② V6 修复：同上 |
| `src/pages/HexagramDetail.tsx` | 改 | ① `<div className="... shadow-lg w-fit">` → 去 `shadow-lg`（V5）；② 6 段加 `<section>` 包裹 + 朱砂细线分隔（D1）；③ 关系计算 useMemo + try/catch（B2） |
| `src/components/sections/DivinationForm.tsx` | 改 | `saveRecord` 调用加 `version: 1` 字段 |

### 2.4 测试 & 验证

| 文件 | 操作 | 改动 |
|---|---|---|
| `tests/components/Forms.test.tsx` | 改 | 加 NumberBox 4 路径回归测试 |
| `tests/components/Button.test.tsx` 等 UI 测试 | 查 | 看是否引用 `Stamp`，如有 → 改 |

### 2.5 不动

- `src/lib/divination.ts` / `daily.ts` / `relations.ts` — 算法不变
- `src/data/hexagrams.json` — 64 卦内容不变
- 路由层不变
- AI 集成不变
- `src/components/motion/*`（BreathEffect 等）
- `src/components/ui/PageTitle.tsx` / `EmptyScroll.tsx` / `Card.tsx` / `Button.tsx` / `NumberBox.tsx`（除 B1 修复外）

---

## 三、关键设计决策

### 3.1 B1 · NumberBox 删末位清空 修复策略

**根因：** 当前 `useEffect([value])` 在用户主动把 value 从 111 推到 null 时也会触发，把本地 text 重置。

**修法：** 用 `useRef` 跟踪"我上次 emit 给 parent 的值"，只有当 parent 给的 value 跟"我 emit 的"不一致时，才同步 text（这才是 parent 主动 reset 的信号）。

```typescript
// 关键 diff（src/components/ui/NumberBox.tsx）
const lastEmittedRef = useRef<number | null>(value)

useEffect(() => {
  // 只在 parent 的 value 跟我们上次 emit 的不同（说明是 parent 主动 reset）时同步
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
    lastEmittedRef.current = num  // 记录"我刚 emit 了 111"
    onChange(num)
  } else {
    lastEmittedRef.current = null
    onChange(null)
  }
}
```

**回退路径验证：**
- `111 → 11`（删末位）：text=11, lastEmitted=null, onChange(null) → parent value=null → useEffect 比较 value(null) === lastEmitted(null) → 不触发。text 保持 "11"。✓
- `空 → 1`：text=1, lastEmitted=null, onChange(null) → parent value=null（不变）→ useEffect 不触发。text 保持 "1"。✓
- `外重置`：parent 把 value 设到 999，useEffect 比较 value(999) !== lastEmitted(原来的 null) → 同步 text='999'。✓

### 3.2 B7 · 抽出 MiniYaoStack 组件

**重要：** 这两个组件的视觉语义**不同**——不是 bug，是有意区分：

| 组件 | highlight 视觉 | 用途 |
|---|---|---|
| `YaoLineStack` 的 `state='highlight'` | 整条线变红（`bg-june-red`） | "动爻"——本卦这一爻是变化的 |
| `MiniHexagramStack` 当前行 | 红环 + 红底 20% 透明（`ring-2 ring-june-red`） | "当前在第 N 爻"——右栏显示的爻是哪条 |

**修法：仅抽代码，不混淆语义。** 把 `MiniYao` + `MiniHexagramStack` 抽到独立文件 `src/components/hexagram/MiniYaoStack.tsx`，API 不变；`YaoLineScroll` 改为 import 新组件。

```typescript
// src/components/hexagram/MiniYaoStack.tsx (新建)
export interface MiniYaoStackProps {
  yaoLines: YaoLine[]      // 6 条爻，提供爻形
  currentLine: number       // 1-6, 高亮哪一行
  className?: string
}

export function MiniYaoStack({ yaoLines, currentLine, className }: MiniYaoStackProps) {
  return (
    <div
      className={cn('flex flex-col bg-rice/60 border border-june-bronze/30 rounded-md p-2', className)}
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
              isCurrent ? 'bg-june-red/20 ring-2 ring-june-red shadow-sm' : 'opacity-60',
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

**风险点：零**——纯抽文件，行为不变。

### 3.3 B2 · 关系计算错误处理

**修法：** 把关系计算放进 `useMemo` + try/catch，错误状态保存到组件 state，降级渲染。

```typescript
// src/pages/HexagramDetail.tsx (关键 diff)
const relationResult = useMemo(() => {
  if (!hexagram) return null
  try {
    const id = activeRelation === 'opposite' ? getOpposite(hexagram.id)
      : activeRelation === 'inverse' ? getInverse(hexagram.id)
      : getNuclear(hexagram.id)
    return { ok: true as const, id, hex: getHexagramById(id as HexagramId) }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : '关系数据缺失' }
  }
}, [hexagram, activeRelation])

// 渲染
{relationResult?.ok && relationResult.hex && (
  <div>... 原有关系 section ...</div>
)}
{relationResult && !relationResult.ok && (
  <div className="text-center text-ink-light/60 text-sm py-6">
    本卦关系数据缺失
  </div>
)}
```

**说明：** 不会改 `lib/relations.ts` 抛错行为——上层降级即可，下层保持纯函数 + 抛错更易测试。

### 3.4 B8 · region/timezone 字段语义 + 版本迁移

**当前问题：** `UserRecord.region` 字段注释是 "用户地区 (e.g. 'Singapore')"，但代码里实际写入的是 IANA 时区 `Asia/Singapore`。schema 撒谎。

**修法（最小）：**
- `region` 字段注释改为"时区 (IANA, e.g. 'Asia/Singapore')"，**不改类型**（都是 string）
- `timezone` 字段**保留**（schema 兼容，不删字段避免迁移负担）
- 加 `version: 1` 字段标记 schema 版本
- 加 `migrateRecord()` 函数：老数据（无 version 字段）补 `version: 1`

```typescript
// src/types/record.ts (改)
export interface UserRecord {
  id: string
  type: 'three-number' | 'daily'
  createdAt: number
  question?: string
  numbers?: [number, number, number]
  region: string       // 时区 (IANA, e.g. 'Asia/Singapore')
  timezone: string     // 同上（保留字段，向后兼容）
  mainHexagramId: HexagramId
  movingLine: 1 | 2 | 3 | 4 | 5 | 6
  changedHexagramId: HexagramId
  aiInterpretation?: string
  userNote?: string
  version: 1           // schema 版本
}

// src/lib/storage.ts (加)
function migrateRecord(raw: unknown): UserRecord {
  if (!raw || typeof raw !== 'object') return raw as UserRecord
  const r = raw as Record<string, unknown>
  if (typeof r.version !== 'number') {
    return { ...r, version: 1 } as UserRecord
  }
  return r as UserRecord
}

// getAllRecords 内
const records: UserRecord[] = []
for (const item of parsed) {
  if (item && typeof item === 'object' && 'id' in item && 'createdAt' in item) {
    records.push(migrateRecord(item))
  }
}

// DivinationForm.tsx saveRecord 调用加
saveRecord({ ..., version: 1 })
```

### 3.5 V4 · Seal 减负版（最终参数）

```typescript
// Seal.tsx 减负版参数
// - bgColor: #9b2c2c (朱砂)
// - stroke: 无外黑边
// - 内细线: stroke="#faf6ec" stroke-width="1" opacity="0.5" (米色)
// - 字号: 38px seal → 32px; 56px seal → 44px; 80px seal → 56px
// - compact prop: 当 true 时，强制字号 = 32px
```

**新视觉规则：**
- 详情页 Hero 卡：seal size=38 (compact) — 不挡爻象
- 详情页 关系 section：seal size=44
- 起卦结果 Hero 卡：seal size=44
- TwinSpread 本/变：seal size=44
- codex sm 卡：**不挂 seal**（保留视觉清爽，避免 80px 宽卡里塞 38px 印）

---

## 四、风险、回滚、测试

### 4.1 风险登记

| ID | 风险 | 等级 | 缓解 |
|---|---|---|---|
| V4 | 5 处同步替换 Stamp→Seal，可能漏改 | 中 | 实施前 `grep -r "from '@/components/ui/Stamp'" src/` 全部罗列；改后 grep 验证为 0 |
| B1 | useRef 方案漏写 emit 时机，bug 重现 | 中 | 单元测试覆盖 4 路径：111→11 / 11→1 / 1→空 / 外重置；CI 跑通才进 commit |
| B7 | 抽文件时 import 路径写错 | 低 | 一次抽完运行 `npx tsc --noEmit` |
| B2 | 关系计算错误过于"静默"，用户感知不到 | 低 | 渲染降级提示"本卦关系数据缺失"明确告诉用户 |
| D1 | 朱砂细线在不同屏幕宽度上视觉重/轻不一 | 低 | 移动端降到 0.5px + 12px 上下 padding |
| B8 | 老数据迁移时 `version` 字段被其他字段误读 | 低 | `migrateRecord` 严格 typeof 检查；老数据补 `version: 1` 后行为不变 |

### 4.2 Commit 顺序（可逐层回滚）

```
commit 1: type+storage (region 注释 + version 字段 + migrateRecord)
commit 2: Seal 增强 (compact prop)
commit 3: MiniYaoStack 新建
commit 4: 5 处 Stamp→Seal 替换 (V4) + Stamp.tsx 删除  ← 原子提交
commit 5: V5 (Hero shadow) + V6 (Hero 冗余字) + D1 (节奏)
commit 6: B7 (YaoLineScroll 改 import MiniYaoStack)
commit 7: B1 (NumberBox useRef)
commit 8: B2 (HexagramDetail try/catch)
```

**关键：** `Stamp.tsx` 删除与 5 处替换必须**同一 commit**，否则 build 断裂。

任一 commit 失败可单独 `git revert <sha>`，不影响其他层。

### 4.3 测试策略

**单元测试**（Vitest + RTL）
- `tests/components/Forms.test.tsx` 加：NumberBox 4 路径回归（111→11 / 11→1 / 1→空 / 外重置）
- `tests/components/Button.test.tsx` 等不涉及改动的测试：保持全绿
- `tests/lib/relations.test.ts`（若存在）：B2 修复不影响，纯函数行为不变

**集成测试**（手动 + 脚本）
- `scripts/verify-j3-flow.mjs`（已有）跑一次——起卦→结果→详情，确认 Stamp 替换不影响流程
- 详情页加载 5 个不同卦（含对开页关系 tab 切换），确认无崩页

**视觉测试**
- 用 `scripts/screenshots.mjs` 跑 6 张关键页（首页/图鉴/详情/起卦/结果/卦册）
- 对比改前（`screenshots/check-*`）与改后：印章变细、Hero 无双 shadow、节奏分隔清晰
- 移动端 (375px) + 桌面 (1280px) 各跑一次

**类型检查**
- `npx tsc --noEmit` 全绿

### 4.4 Done 判据（DoD）

满足**全部**才算完成：

- [ ] 8 个改动项（B1, V4, V5, V6, B7, B8, D1, B2）全部在 commit 列表中
- [ ] `grep -r "from '@/components/ui/Stamp'" src/` 结果为 0
- [ ] `grep -r "MiniHexagramStack" src/components/hexagram/YaoLineScroll.tsx` 结果为 0
- [ ] `npm test` 全绿，新增 B1 回归测试 4 条全 pass
- [ ] `npx tsc --noEmit` 0 错
- [ ] 6 张关键页截图（桌面 + 移动）保存到 `screenshots/after-*`，目视无回归
- [ ] 至少 1 个卦走完 起卦 → 详情 流程无控制台错误
- [ ] 1 个含 `version` 字段缺失的 mock 老 record 能被 `migrateRecord` 正确加 `version: 1`

---

## 五、显式不做

- 64 卦数据 (`hexagrams.json`)
- 起卦算法 (`divination.ts` / `daily.ts` / `relations.ts`)
- 路由层 (`App.tsx` / `routes.tsx`)
- AI 集成 (`ai.ts` / 后端)
- P2 全部：
  - `RelationTabs` 死代码清理
  - `hexagrams.json` 按主题懒加载
  - 详情页 `▎释/今` 装饰符替换
  - 关系 tab 改"真正对开页"双页并置
- 后端（`server/`）任何改动

---

## 六、决策回顾

### 6.1 视觉方向选择

| 决策点 | 选项 | 选 | 理由 |
|---|---|---|---|
| 爻线渲染 | A 当前 / B 粗+宽断口 / C 极细 / D 阴灰阳黑 / E 朱砂阳墨阴 | **A** | 用户偏好保持当前参数；改爻形偏离传统"卦象全黑"观感 |
| 印章 | A div Stamp / B SVG Seal(Header) / C Seal 减负版 / D 印泥厚薄 | **C** | sm 也能清晰，仪式感不减，去除 sm 下外黑边过重问题 |

### 6.2 范围选择

| 方案 | 范围 | 选 |
|---|---|---|
| A 完整重做 | P0 全部 + P1 全部（8 项） | **✓** |
| B 最小可交付 | 只 P0（4 项） | ✗ |
| C 折中 | P0 + 关键 P1（6 项） | ✗ |

选 A 理由：P0 + P1 一次写完，避免分两轮的迁移成本；B7（合并 Mini）与 D1（详情页节奏）有依赖关系，一起做更顺。

### 6.3 实施顺序

按 import 拓扑排序：①Foundation → ②共享组件 → ③调用方 → ④测试。每层独立 commit，可逐层 revert。

---

## 七、参考资源

- 主设计稿: `docs/superpowers/specs/2026-06-02-zhouyi-website-design.md`
- 视觉对比: `D:\eight\.superpowers\visual\stamp-vs-seal.html`
- 改后预览: `D:\eight\.superpowers\visual\hexagram-after-preview.html`
- 现有截图: `D:\eight\screenshots\check-*`, `D:\eight\screenshots\j3-*`

---

**文档结束。**
