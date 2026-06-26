# 起卦结果页 · 「解卦」文案与「所问之事」小节 · 设计规格

**版本：** 1.0
**日期：** 2026-06-26
**状态：** Draft — 待用户复审
**分支：** main
**前置 spec：** [2026-06-02-zhouyi-website-design.md](./2026-06-02-zhouyi-website-design.md), [2026-06-08-hexagram-optimization-design.md](./2026-06-08-hexagram-optimization-design.md)

> 本 spec 是「起卦结果页」用户可见文案的**小范围改名 + AI 输出扩段**，不修改视觉 token、不引入新依赖、不动后端 / Worker / SSE 协议。

---

## 一、目标与范围

### 1.1 目标

1. 把起卦结果页上「AI 解读」相关的用户可见文案统一替换为「解卦」——「解卦」是周易传统术语（"解读卦象"），语感更贴本产品国风基调
2. 让 AI 解读的输出**显式回应用户的具体提问**：在原本 6 段之后新增第 7 段「关于所问之事」，让用户感到"卦在回应我的事"，而不是"AI 在泛泛解读卦"

### 1.2 范围

| ID | 标题 | 类型 |
|---|---|---|
| R1 | 「AI 解读」→「解卦」文案替换 | 文案 / 测试 |
| R2 | AI prompt 新增「## 关于所问之事」第 7 段 | AI 输出格式 |
| R3 | ResultDisplay 默认提示语 / 错误文案同步替换 | 文案 |
| R4 | Settings 页「AI 解读 (BYOK)」标题同步 | 文案 |
| R5 | ResultDisplay.test.tsx 断言文案同步 | 测试 |

### 1.3 非范围

明确**不做**：
- 视觉 token (`tokens.css`)、色板、字体
- 函数 / 类型 / 变量名（`generateInterpretation`, `aiInterpretation`, `AIError` 等保留为代码层标识）
- `index.html` meta description 中的「AI 解读」SEO 关键词（保留，避免影响搜索收录）
- 后端 / Worker / SSE 协议 / Pages Function
- 64 卦数据 / 起卦算法 / 关系计算
- 历史 mockup / 设计 spec / 部署 doc（决策产物，保留）
- legacy `server/`（CLAUDE.md 已声明未部署）

---

## 二、文案替换映射

| # | 文件 | 行号 | 旧 | 新 |
|---|---|---|---|---|
| 1 | `src/components/sections/ResultDisplay.tsx` | 282 | `AI 解 读`（h2 标题） | `解 卦` |
| 2 | `src/components/sections/ResultDisplay.tsx` | 312 | `开始 AI 解读` | `开始解卦` |
| 3 | `src/components/sections/ResultDisplay.tsx` | 312 | `解读中…`（loading 态） | `解卦中…` |
| 4 | `src/components/sections/ResultDisplay.tsx` | 135 | `AI 解读失败`（catch 兜底） | `解卦失败` |
| 5 | `src/components/sections/ResultDisplay.tsx` | 324 | `点击右上"开始 AI 解读"获取现代视角分析。` | `点击右上"开始解卦"获取 AI 现代视角分析。` |
| 6 | `src/pages/Settings.tsx` | 109 | `AI 解读 (BYOK)` | `解卦 (BYOK)` |
| 7 | `tests/components/ResultDisplay.test.tsx` | 64–124 | `AI 解读` / `开始 AI 解读` | `解卦` / `开始解卦` |
| 8 | `src/components/sections/ResultDisplay.tsx` | 29 | 块注释 `// 3. AI 解读 · 简易版 (with "查看完整" expand)` | `// 3. 解卦 · 简易版` |

---

## 三、AI prompt 新增章节

### 3.1 改动位置

`src/lib/ai.ts` 的 `buildSystemPrompt` 函数返回的 system prompt 中，「【输出格式】」之后、6 段标题之后追加第 7 段。

### 3.2 新增内容

在现有 6 段之后追加：

```
## 关于所问之事
（40-60 字，简短回应用户的问题：把卦象、动爻、本卦名字义与用户原问题三向对接，让用户感到"卦在回应我的事"。例：「你问晋升，恰落本卦'晋'字——晋者，进也；第五爻居尊位而得吉，提示你正逢升势。」）
```

### 3.3 写作要求追加

在「【写作要求】」末尾追加：

```
- 若用户未提具体问题（无 question 字段），本段改为对卦象本身的简短注释，不留空
- 「关于所问之事」必须紧扣用户原话中的关键词（如"晋升""求财""感情"），不可泛泛而谈
```

### 3.4 输出位置

新增段落是 AI 输出的**最后一段**，对应 `InterpretationRenderer` 解析出的第 7 个 `<h3>`。

UI 位置：起卦结果页中「解卦」section 内、AI 流式输出末尾，视觉上紧跟原本 6 段之下——由于「解卦」section 整体位于「本卦 + 动爻爻辞」卡片下方，第 7 段也就自然落在「动爻爻辞 modernMeaning」之后，满足用户要求。

---

## 四、错误处理与降级

| 场景 | 行为 |
|---|---|
| AI 未生成第 7 段 | `parseSections` 仅解析出 6 段，无显示问题；不报错 |
| AI 跑题写出与提问无关的内容 | 不处理——这是 AI 输出质量问题，非本次范围 |
| `record.question` 为空 / 仅有空白 | prompt 已含「（用户未提具体问题，做通用解读）」占位；新章节降级为卦象本身的简短注释 |
| 现有 AIError 兜底文案 | 「AI 解读失败」改为「解卦失败」（R1.4） |
| Tests 找不到旧按钮 | 同步替换断言文案（R5） |

---

## 五、测试

### 5.1 现有测试更新

`tests/components/ResultDisplay.test.tsx`：
- L64 `renders the AI 解读 button initially` → `renders the 解卦 button initially`
- L71 `getByRole('button', { name: '开始 AI 解读' })` → `{ name: '开始解卦' }`
- L82 click 触发器同步
- L124 `queryByRole('button', { name: '开始 AI 解读' })` → `{ name: '开始解卦' }`

### 5.2 新增测试

`tests/lib/ai.test.ts`（如不存在则跳过；如已存在则加）：
- `buildSystemPrompt includes the 关于所问之事 section`
- `buildSystemPrompt includes the user question keyword when provided`
- `buildSystemPrompt falls back to generic interpretation when question is missing`

### 5.3 人工验收

按 `scripts/verify-j3-flow.mjs` 流程跑一次解卦按钮点击，确认：
1. 按钮文案为「开始解卦」
2. 加载中文案为「解卦中…」
3. 流式输出末尾出现 `## 关于所问之事` 段落
4. 文案包含用户提问的关键词

---

## 六、保留不变（用户可能误判的部分）

| 项 | 为何不动 |
|---|---|
| `generateInterpretation` / `AIError` / `aiInterpretation` / `interpretationText` 等标识符 | 代码层命名，用户看不到 |
| `src/types/record.ts` L40 注释「AI 解读 (用户主动请求时缓存)」 | 注释不是用户可见文案 |
| `index.html` L7 meta description「工笔重彩视觉风格,今日卦境、三数起卦、AI 解读。」 | SEO 关键词，文案改不改不影响本次核心目标 |
| 模拟脚本 `scripts/repro-flow.mjs` / `scripts/verify-j3-flow.mjs` 中的 console.log | 调试脚本，可选改可不改；本次不动 |
| `docs/mockups/*` / `docs/deploy/*` / `server/` 全部「AI 解读」 | 历史产物 / 未部署代码 |
| `src/components/sections/ResultDisplay.tsx` L29 块注释（除 R1.8 同步外其余） | 仅同步「简易版」相关一句 |

---

## 七、风险与回滚

| 风险 | 概率 | 缓解 / 回滚 |
|---|---|---|
| 用户不认可「解卦」命名 | 低（已直接确认） | `git revert <commit>`；单次提交即可全量回退 |
| AI 第 7 段偶尔不输出 | 中 | 用户感知不到——只是少一段，不报错；不处理 |
| AI 第 7 段跑题 | 中 | 属 AI 质量问题；不处理 |
| demo 配额多消耗 ~80-150 token/次 | 低（每日 5 次额度内） | 不优化；超过 5 次本就走 BYOK |
| 单测文案遗漏 | 中 | `git grep -n "开始 AI 解读\|AI 解 读\|解读中\|AI 解读失败" src/ tests/` 应为空 |
| prompt 改动触发 AI 输出格式不稳 | 低 | 6 段标题与字号、间距不变，仅追加第 7 段 |

---

## 八、实施清单

按依赖顺序：

1. `src/lib/ai.ts` — `buildSystemPrompt` 新增第 7 段
2. `src/components/sections/ResultDisplay.tsx` — 5 处文案替换 + 注释同步
3. `src/pages/Settings.tsx` — 1 处标题替换
4. `tests/components/ResultDisplay.test.tsx` — 断言文案同步
5. `tests/lib/ai.test.ts` — 新增章节断言（如文件存在）
6. `npx tsc -b` 类型检查
7. `npm test` 单测
8. `npm run lint` 风格检查
9. `node scripts/verify-j3-flow.mjs` 端到端验证（可选）