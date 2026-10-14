# 易象阁趣味化增强 v4：交互优化迭代

**日期**: 2026-08-12
**状态**: 用户反馈后的迭代版

## 用户反馈的 4 个优化需求

### 1. "天降灵数"按钮化
- 现状：`variant="ghost"` 透明背景，看起来像纯文字
- 改：`variant="secondary"`（宣纸底 + 赭石描边），有明确按钮形状

### 2. 去掉 DEV variant 切换器
- 现状：DivinationForm 有 `import.meta.env.DEV` radio（reel/scroll/stem-branch）
- 改：删除切换器，只保留数字滚动（reel）风格
- 删除文件：`RandomizerScroll.tsx`、`RandomizerStemBranch.tsx`

### 3. 随机数交互改为"用户自主取数"
- 现状：点击后自动播放 1.4s 动画，自动停止
- 改：
  - 点击"天降灵数" → 进入 rolling 状态
  - **每秒生成一个新的随机数**（用户可看到数字在变）
  - 用户点击"停止" → **锁定当前显示的数** → 写入输入框
  - **10 秒超时** → 自动锁定最后一个数
  - 意义：用户自己按停止 = 用户参与感（自主取数），10s 超时防呆

### 4. "所问之事"预填随机问询
- 现状：placeholder="请输入您想询问的问题（可选）"，空输入提交
- 改：
  - 预填一个**随机问询**（从预置数组随机选，每次不同）
  - 预填文字**颜色淡**（text-ink-light/50），用户输入后变深色
  - 预填值**可直接提交**（用户确认）

## 文件改动清单

| 文件 | 改动 |
|---|---|
| `src/lib/sampleQuestions.ts` (new) | 预置问询数组 + `getRandomSampleQuestion()` 随机选取 |
| `tests/lib/sampleQuestions.test.ts` (new) | 数组非空 + 随机性测试 |
| `src/components/ui/QuestionInput.tsx` | 支持预填淡色（内部跟踪 touched，未编辑时淡色） |
| `src/components/ui/NumberBoxRandomizer/shared.ts` | 状态机重写：rolling（每秒出数）/ locked |
| `src/components/ui/NumberBoxRandomizer/index.tsx` | 新交互 + 按钮化 |
| `src/components/ui/NumberBoxRandomizer/RandomizerReel.tsx` | 改为纯显示组件（接收 displayValue） |
| delete `RandomizerScroll.tsx` / `RandomizerStemBranch.tsx` | 删除变体 |
| `src/components/sections/DivinationForm.tsx` | 去掉切换器 + 预填问询 |
| `tests/components/NumberBoxRandomizer.test.tsx` | 更新为新交互测试 |
| `tests/components/DivinationForm.test.tsx` | 更新（预填问询） |

## 新状态机设计

```ts
type RandomizerState =
  | { kind: 'idle' }
  | { kind: 'rolling' }                    // 每秒出数中
  | { kind: 'locked'; finalValue: number } // 已锁定

type RandomizerAction =
  | { type: 'START' }
  | { type: 'LOCK'; finalValue: number }
  | { type: 'RESET' }
```

hook: `useManualRandomizer({ onLock, tickMs = 1000, timeoutMs = 10000 })`
- START → rolling：setInterval 每秒 `rollFinal()` 更新 displayValue
- LOCK（用户停止或超时）→ locked，调用 onLock(finalValue)
- displayValue 用 ref 保存最新值，stop() / timeout 读取

## 测试策略

- `NumberBoxRandomizer.test.tsx`：
  - 点击 → rolling（按钮变"停止"）
  - fake timers 推进 1s → 数字变化（onChange 未触发）
  - 点"停止" → onChange 收到 [100,999] 数字
  - 10s 超时 → onChange 自动触发
  - reduced-motion → 点击直接锁定
- `DivinationForm.test.tsx`：预填问询渲染（getByDisplayValue）
- `sampleQuestions.test.ts`：数组 ≥ 5 条、每次随机不同