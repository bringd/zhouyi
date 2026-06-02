# 易象阁 — 64 卦周易研究网站 MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 8-10 周内交付"易象阁"——一个 64 卦周易研究网站 MVP，使用 Vite + React 18 + TypeScript + Tailwind + Framer Motion 技术栈，工笔重彩视觉风格，纯前端无后端。

**Architecture:** 单页应用（SPA），5 个核心路由。64 卦数据预存为 JSON，运行时通过纯函数计算关系与起卦。AI 解读通过用户自带的 Claude API Key 在浏览器直连。所有用户记录存 LocalStorage。构建产物部署到 Cloudflare Pages。

**Tech Stack:**
- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS 3（设计 tokens 通过 `tailwind.config.ts` 注入）
- Framer Motion 11（动效）
- React Router 6（路由）
- Zustand 4（用户记录状态）
- Lucide React（图标）
- Vitest（单元测试）
- TypeScript strict 模式

**Spec 引用：** 完整产品规格见 `docs/superpowers/specs/2026-06-02-zhouyi-website-design.md`，本计划是该规格的执行分解。

---

## 实施阶段概览

| Phase | 任务范围 | 预计工作量 |
|---|---|---|
| Phase 1: 项目基础设施 | Tasks 1-5（Vite 脚手架、依赖、配置）| 1 周 |
| Phase 2: 设计系统 | Tasks 6-9（tokens、字体、全局样式）| 3-4 天 |
| Phase 3: 数据层 | Tasks 10-14（类型、JSON 数据、关系索引）| 2-3 周 |
| Phase 4: 业务逻辑 | Tasks 15-19（lib/ 函数 + 单元测试）| 1-1.5 周 |
| Phase 5: UI 组件 | Tasks 20-28（卦象卡、动效、表单）| 1.5-2 周 |
| Phase 6: 页面 | Tasks 29-36（5 个页面 + 路由）| 1.5-2 周 |
| Phase 7: AI 与存储 | Tasks 37-39（AI 集成、Zustand store）| 1 周 |
| Phase 8: 打磨上线 | Tasks 40-46（SEO、性能、测试、部署）| 1 周 |
| **总计** | **46 个任务** | **8-10 周** |

---

## Phase 1: 项目基础设施（Tasks 1-5）

### Task 1: 初始化 Vite + React + TypeScript 项目

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`

- [ ] **Step 1: 删除占位 .gitkeep，准备 src 结构**

```bash
cd D:/eight
rm src/.gitkeep public/.gitkeep tests/.gitkeep
```

- [ ] **Step 2: 创建 package.json**

写入 `package.json`：

```json
{
  "name": "zhouyi",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -b --noEmit",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "format": "prettier --write \"src/**/*.{ts,tsx,css}\""
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "framer-motion": "^11.5.4",
    "zustand": "^4.5.5",
    "lucide-react": "^0.439.0",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@types/node": "^22.5.5",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.6",
    "vitest": "^2.1.1",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.5.0",
    "jsdom": "^25.0.0",
    "tailwindcss": "^3.4.10",
    "postcss": "^8.4.45",
    "autoprefixer": "^10.4.20",
    "prettier": "^3.3.3"
  }
}
```

- [ ] **Step 3: 安装依赖**

```bash
cd D:/eight && npm install
```

预期：node_modules 目录被创建，package-lock.json 生成。

- [ ] **Step 4: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: 创建 tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
```

- [ ] **Step 7: 创建 index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="易象阁 — 64 卦周易研究网站，工笔重彩视觉风格，今日卦境、三数起卦、AI 解读。" />
    <title>易象阁 — 64 卦周易研究</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: 创建 src/main.tsx**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 9: 创建 src/App.tsx（最小版本，后续 task 替换）**

```typescript
export default function App() {
  return <div>易象阁</div>
}
```

- [ ] **Step 10: 验证 TypeScript 配置**

```bash
cd D:/eight && npx tsc --noEmit
```

预期：无错误（exit code 0）。

- [ ] **Step 11: 提交**

```bash
git add .
git commit -m "chore: initialize Vite + React + TypeScript project"
```

---

### Task 2: 配置 Tailwind CSS 与设计 tokens

**Files:**
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `src/styles/tokens.css`（见 Phase 2 Task 6）
- Create: `src/styles/global.css`（见 Phase 2 Task 7）

- [ ] **Step 1: 安装 Tailwind 及其 PostCSS 依赖**（已在 Task 1）
- [ ] **Step 2: 创建 tailwind.config.ts，注入 spec 4.2 节的全部颜色 tokens、字体、间距**
- [ ] **Step 3: 创建 postcss.config.js**
- [ ] **Step 4: 运行 npm run dev 验证 Tailwind 编译通过**
- [ ] **Step 5: 提交**

**验收：** 在 App.tsx 中能用 `bg-june-red text-rice` 这样的工具类。

---

### Task 3: 创建测试基础设施

**Files:**
- Create: `tests/setup.ts`
- Create: `vitest.config.ts`（如需要，可合并到 vite.config.ts）

- [ ] **Step 1: 创建 tests/setup.ts，引入 @testing-library/jest-dom**
- [ ] **Step 2: 写一个简单 smoke test（"expect(1).toBe(1)"）验证 Vitest 工作**
- [ ] **Step 3: 提交**

**验收：** `npm run test` 通过。

---

### Task 4: 创建项目 README 与开发文档

**Files:**
- Modify: `README.md`（已有，扩展）

- [ ] **Step 1: 扩展 README.md，加入：架构图、常用命令、贡献指南、目录说明**
- [ ] **Step 2: 提交**

**验收：** 新加入项目的开发者能只读 README 就开始工作。

---

### Task 5: Phase 1 验证与里程碑

- [ ] **Step 1: 运行 npm run dev，确认开发服务器在 http://localhost:5173 启动**
- [ ] **Step 2: 运行 npm run build，确认生产构建成功**
- [ ] **Step 3: 运行 npm run test，确认测试通过**
- [ ] **Step 4: 运行 npm run typecheck，确认无类型错误**
- [ ] **Step 5: 截图首页（虽然只有"易象阁"三字）并提交**

**验收：** 4 个命令全部通过，提交一个"chore: phase 1 complete"里程碑。

---

## Phase 2: 设计系统（Tasks 6-9）

### Task 6: 实现设计 tokens（CSS 变量）

**Files:** Create `src/styles/tokens.css`

- Step 1: 按 spec 4.2 节的颜色 tokens 写入 CSS 变量（朱砂红、藤黄、赭石、石绿、宣纸等）
- Step 2: 提交

**验收：** tokens.css 包含全部矿物质色 CSS 变量。

---

### Task 7: 全局样式与基础重置

**Files:** Create `src/styles/global.css`

- Step 1: 在 global.css 引入 tokens.css
- Step 2: 设置 body 字体为霞鹜文楷、背景为宣纸色
- Step 3: 添加基础 reset (box-sizing, margin, padding)
- Step 4: 提交

**验收：** 任何页面的 body 默认是宣纸底 + 霞鹜文楷字体。

---

### Task 8: 引入中文字体

**Files:** Modify `index.html`；Create `public/fonts/`

- Step 1: 下载霞鹜文楷 + 思源宋体的子集化 woff2 文件
- Step 2: 在 index.html 添加字体 @font-face 声明
- Step 3: 验证页面字体生效
- Step 4: 提交

**验收：** 页面文字实际渲染为霞鹜文楷（衬线感强）。

---

### Task 9: 视觉设计样例集（参考页）

**Files:** Create `src/pages/_styleguide.tsx`（开发可见）

- Step 1: 创建 /styleguide 路由，展示所有颜色、字体、间距、动效的实时样例
- Step 2: 提交

**验收：** /styleguide 是开发者的"调色盘"，所有设计 token 都在这里可见。

---

## Phase 3: 数据层（Tasks 10-14）

### Task 10: 定义 TypeScript 类型

**Files:** Create `src/types/trigram.ts` `src/types/hexagram.ts` `src/types/record.ts` `src/types/index.ts`

- Step 1: 按 spec 3.1-3.3 节定义 Trigram、Hexagram、YaoLine、UserRecord、UserSettings 类型
- Step 2: 写类型单元测试验证字段
- Step 3: 提交

**验收：** typecheck 通过，类型与 spec 一致。

---

### Task 11: 录入八卦数据（8 条）

**Files:** Create `src/data/trigrams.json`

- Step 1: 按 spec 3.1 节录入 8 个八卦全部字段
- Step 2: 测试：8 条数据 id 唯一且 1-8
- Step 3: 提交

---

### Task 12: 录入 64 卦基础字段

**Files:** Create `src/data/hexagrams.json`（分批）；Create `data/hexagrams-template.csv`

- Step 1: 创建 CSV 模板
- Step 2: 录入 1-16 卦基础字段（id、number、name、shortName、upperTrigramId、lowerTrigramId、binaryCode、palace、palaceRole、keywords）
- Step 3: 测试：卦数 1-64 唯一、上下卦 ID 合法、binaryCode 与爻对应
- Step 4: 录入 17-32、33-48、49-64 卦（分多次提交）
- Step 5: 提交

**验收：** 64 卦基础字段完整。

**预计工作量：** 1-2 周（计划中最大的内容任务）。

---

### Task 13: 录入 64 卦原文（卦辞、彖传、象传）

**Files:** Modify `src/data/hexagrams.json`

- Step 1: 录入 1-16 卦的 judgement、tuanzhuan、xiangzhuan
- Step 2: 校验文本无错别字
- Step 3: 录入 17-32、33-48、49-64 卦
- Step 4: 提交

**验收：** 64 卦原文完整、无错别字。

**预计工作量：** 1-1.5 周。

---

### Task 14: 录入 64 卦爻辞 + 现代解读

**Files:** Modify `src/data/hexagrams.json`

- Step 1: 录入 1-16 卦的 6 条 yaoLines（含 originalText、explanation、modernMeaning）
- Step 2: 录入 1-16 卦的 modernInterpretation
- Step 3: 录入 17-32、33-48、49-64 卦
- Step 4: 测试：每卦 6 条爻、每条爻有原文+解释+现代意义
- Step 5: 提交

**验收：** 64 × 6 = 384 条爻辞 + 64 段现代解读完整。

**预计工作量：** 1-1.5 周。

---

## Phase 4: 业务逻辑（Tasks 15-19）

### Task 15: 实现三数起卦算法（divination.ts）

**Files:** Create `src/lib/divination.ts` `tests/lib/divination.test.ts`

- Step 1: 写 5 个测试：输入 A、B、C 输出 {lowerTrigramId, upperTrigramId, movingLine, mainHexagramId, changedHexagramId}
- Step 2: 实现 divination.ts
- Step 3: 测试通过
- Step 4: 提交

**关键测试：** A=427, B=831, C=562 → 下卦=3(离), 上卦=7(艮), 动爻=4, 本卦=山火贲；mod 8 = 0 时取第 8 卦

---

### Task 16: 实现卦象关系计算（relations.ts）

**Files:** Create `src/lib/relations.ts` `tests/lib/relations.test.ts`

- Step 1: 写测试：错卦（6 爻全变）、综卦（上下颠倒）、互卦（2-3-4 为下，3-4-5 为上）
- Step 2: 实现 relations.ts
- Step 3: 测试通过
- Step 4: 提交

**关键测试：** 乾(111111)→ 错=坤(000000)；屯(100010)→ 综=鼎；需(111010)→ 互=晋

---

### Task 17: 实现今日卦境生成（daily.ts）

**Files:** Create `src/lib/daily.ts` `tests/lib/daily.test.ts`

- Step 1: 写测试：同一天同一时区返回相同卦；不同时区可能不同
- Step 2: 实现 daily.ts（基于 Intl.DateTimeFormat + 哈希种子）
- Step 3: 测试通过
- Step 4: 提交

---

### Task 18: 实现 LocalStorage 封装（storage.ts）

**Files:** Create `src/lib/storage.ts` `tests/lib/storage.test.ts`

- Step 1: 写测试：CRUD、容量超限降级、隐私模式降级
- Step 2: 实现 storage.ts（含 try/catch、JSON 序列化）
- Step 3: 测试通过
- Step 4: 提交

---

### Task 19: 实现 AI 解读调用（ai.ts）

**Files:** Create `src/lib/ai.ts` `tests/lib/ai.test.ts`（mock fetch）

- Step 1: 写测试：构造 prompt、解析响应、错误处理
- Step 2: 实现 ai.ts（基于 fetch 调用 Claude API，支持流式）
- Step 3: 测试通过
- Step 4: 提交

**验收：** 无 Key 时友好提示；有 Key 时调用 claude-haiku-4-5。

---

## Phase 5: UI 组件（Tasks 20-28）

### Task 20: cn 工具函数

**Files:** Create `src/utils/cn.ts`

- Step 1: 实现 clsx wrapper
- Step 2: 提交

---

### Task 21: 通用 UI - Button

**Files:** Create `src/components/ui/Button.tsx`

- Step 1: 实现 Button（variants: primary / secondary / ghost, sizes: sm / md / lg）
- Step 2: 加 Framer Motion hover/tap 反馈
- Step 3: 提交

---

### Task 22: 通用 UI - Card

**Files:** Create `src/components/ui/Card.tsx`

- Step 1: 实现 Card（宣纸底 + 赭石描边）
- Step 2: 提交

---

### Task 23: 通用 UI - Stamp（印章）

**Files:** Create `src/components/ui/Stamp.tsx`

- Step 1: 实现印章 SVG（朱砂底 + 反白字）
- Step 2: 提交

**验收：** Stamp text="乾" 渲染红色方块 + 白字"乾"。

---

### Task 24: 卦象核心 - HexagramGlyph（单爻）

**Files:** Create `src/components/hexagram/HexagramGlyph.tsx`

- Step 1: 实现单爻渲染（yin/yang + 状态：normal/highlight/changed）
- Step 2: 写组件测试
- Step 3: 提交

---

### Task 25: 卦象核心 - YaoLineStack（6 爻堆叠）

**Files:** Create `src/components/hexagram/YaoLineStack.tsx`

- Step 1: 实现 6 爻垂直堆叠
- Step 2: props: lines, highlightLine?
- Step 3: 测试
- Step 4: 提交

---

### Task 26: 卦象核心 - HexagramCard

**Files:** Create `src/components/hexagram/HexagramCard.tsx`

- Step 1: 实现卦象卡（hexagramId, size: sm/md/lg, onClick）
- Step 2: 3 种 size
- Step 3: 加 Stamp 装饰
- Step 4: 加 Framer Motion hover（旋转 2°、颜色变化）
- Step 5: 提交

---

### Task 27: 卦象核心 - TwinSpread（双卦对开页）

**Files:** Create `src/components/hexagram/TwinSpread.tsx`

- Step 1: 实现双卦对开页（工笔风）
- Step 2: 中间加箭头 + 动爻标识
- Step 3: 提交

---

### Task 28: 动效封装 - BreathEffect / FlipEntry / PageTransition

**Files:** Create `src/components/motion/BreathEffect.tsx` `src/components/motion/FlipEntry.tsx` `src/components/motion/PageTransition.tsx`

- Step 1: BreathEffect（4.5s 呼吸光晕循环）
- Step 2: FlipEntry（180° 翻转 + 弹性放大 + 模糊聚焦）
- Step 3: PageTransition（淡入淡出）
- Step 4: 提交

**验收：** 3 个动效组件可独立使用，参数符合 spec 4.5。

---

## Phase 6: 页面（Tasks 29-36）

### Task 29: 表单组件 - QuestionInput / NumberBox / RelationTabs

**Files:** Create `src/components/ui/QuestionInput.tsx` `src/components/ui/NumberBox.tsx` `src/components/ui/RelationTabs.tsx`

- Step 1: 实现 QuestionInput（200 字限制）
- Step 2: 实现 NumberBox（3 位数）
- Step 3: 实现 RelationTabs
- Step 4: 提交

---

### Task 30: 首页区块 - DailyHero

**Files:** Create `src/components/sections/DailyHero.tsx`

- Step 1: 实现 C 杂志非对称布局
- Step 2: 用 FlipEntry + BreathEffect 包卦象卡
- Step 3: 提交

---

### Task 31: 图鉴区块 - CodexGrid

**Files:** Create `src/components/sections/CodexGrid.tsx`

- Step 1: 实现主题分类网格（D 默认）
- Step 2: 实现八宫网格（C 切换）
- Step 3: 顶部分组标签 + 切换 tab
- Step 4: 提交

---

### Task 32: 起卦区块 - DivinationForm

**Files:** Create `src/components/sections/DivinationForm.tsx`

- Step 1: 实现问题 + 三数 + 启卦表单
- Step 2: 提交后调用 divination.ts 计算并导航到结果页
- Step 3: 提交

**验收：** 提交 → 计算 → 跳转结果页流程跑通。

---

### Task 33: 结果区块 - ResultDisplay

**Files:** Create `src/components/sections/ResultDisplay.tsx`

- Step 1: 实现起卦结果展示（卦象 + 解读 + 关系）
- Step 2: 加 "AI 深入解读" 按钮（调用 ai.ts）
- Step 3: 加 "收藏入卦册" 按钮（调用 storage.ts）
- Step 4: 提交

---

### Task 34: 布局 - Header / Footer / PageLayout

**Files:** Create `src/components/layout/Header.tsx` `src/components/layout/Footer.tsx` `src/components/layout/PageLayout.tsx`

- Step 1: Header（Logo + 导航 + 设置）
- Step 2: Footer（关于 + 易学书院 + 我的卦册 + 备案）
- Step 3: PageLayout（包装 Header + Outlet + Footer）
- Step 4: 提交

---

### Task 35: 页面 - Home / Codex / HexagramDetail

**Files:** Create `src/pages/Home.tsx` `src/pages/Codex.tsx` `src/pages/HexagramDetail.tsx`

- Step 1: Home.tsx = PageLayout + DailyHero
- Step 2: Codex.tsx = PageLayout + CodexGrid
- Step 3: HexagramDetail.tsx = PageLayout + 详情内容
- Step 4: 提交

---

### Task 36: 页面 - Divination / Result / NotFound + 路由配置

**Files:** Create `src/pages/Divination.tsx` `src/pages/Result.tsx` `src/pages/NotFound.tsx`；Modify `src/App.tsx`

- Step 1: Divination.tsx = PageLayout + DivinationForm
- Step 2: Result.tsx = PageLayout + ResultDisplay，根据 URL 参数读取 record
- Step 3: NotFound.tsx 404 页面
- Step 4: App.tsx 用 React Router 配置所有路由
- Step 5: 提交

**验收：** 5 个核心路由 + 404 全部工作。

---

## Phase 7: AI 与存储（Tasks 37-39）

### Task 37: Zustand store - useStore

**Files:** Create `src/store/useStore.ts`

- Step 1: 实现 Zustand store 管理用户记录、设置
- Step 2: actions: addRecord, removeRecord, updateNote, setApiKey
- Step 3: store 测试
- Step 4: 提交

---

### Task 38: 我的卦册页（Records）

**Files:** Create `src/pages/Records.tsx`；Modify `src/App.tsx`

- Step 1: 记录列表页（按时间倒序）
- Step 2: 每条记录可点击查看详情、可删除、可加备注
- Step 3: 添加到导航
- Step 4: 提交

---

### Task 39: AI Key 管理 UI

**Files:** Create `src/components/ui/ApiKeyDialog.tsx`；Modify `src/components/layout/Header.tsx`

- Step 1: API Key 输入弹窗
- Step 2: 加密存储到 LocalStorage（用 Web Crypto API）
- Step 3: 设置按钮可触发弹窗
- Step 4: 提交

**验收：** 用户能输入、查看（脱敏）、清除 API Key。

---

## Phase 8: 打磨上线（Tasks 40-46）

### Task 40: SEO meta 标签

**Files:** Create `src/lib/seo.ts`

- Step 1: 安装 react-helmet-async
- Step 2: 创建 SEO 组件
- Step 3: 在 5 个页面中使用
- Step 4: 提交

**验收：** 每页有独立 title/description，Open Graph 齐全。

---

### Task 41: Sitemap / Robots

**Files:** Create `public/sitemap.xml`（生成脚本）`public/robots.txt`

- Step 1: 写 Node 脚本从 hexagrams.json 生成 sitemap.xml
- Step 2: 创建 robots.txt
- Step 3: 加 npm script "build:sitemap"
- Step 4: 提交

**验收：** 5 主页面 + 64 卦详情页都在 sitemap 中。

---

### Task 42: 性能优化 - 路由级 code splitting

**Files:** Modify `src/App.tsx`

- Step 1: 用 React.lazy 包装 5 个页面
- Step 2: 加 Suspense 边界 + loading 状态
- Step 3: 提交

**验收：** build 产物中每页独立 chunk；首屏只加载 Home。

---

### Task 43: 字体子集化

**Files:** Modify 字体文件 + 构建配置

- Step 1: 用 fonttools 提取项目用到的汉字子集
- Step 2: 替换 fonts/ 目录下的 woff2
- Step 3: 验证
- Step 4: 提交

**验收：** 字体文件 < 200KB。

---

### Task 44: 端到端测试（Playwright，可选）

**Files:** Create `tests/e2e/`

- Step 1: 安装 @playwright/test
- Step 2: 3 个 e2e：首页→起卦→结果、图鉴→详情、收藏记录
- Step 3: 提交

**注：** MVP 可不做；留给 Phase 9。

---

### Task 45: 视觉与多设备测试

- Step 1: Chrome / Safari / Firefox / Edge 截图首页
- Step 2: 桌面（1920）、平板（1024）、手机（375）三种宽度
- Step 3: 修复发现的视觉 bug
- Step 4: 提交

---

### Task 46: 部署到 Cloudflare Pages

- Step 1: 注册 Cloudflare 账号
- Step 2: 连接 GitHub 仓库
- Step 3: 配置构建：npm run build，输出 dist
- Step 4: 配置环境变量
- Step 5: 触发首次部署
- Step 6: README 添加线上 URL
- Step 7: 提交 "chore: MVP v1.0 deployed"

**验收：** 线上 URL 正常访问。

---

## 后续（Phase 9+）— 不在 MVP 范围

- 用户账号 + 云同步
- 卦象关系可视化（错/综/互/变 全景图）
- AI 学习助手（聊天式问卦）
- 多语言（英文 / 日文版《周易》解读）
- 卦象图鉴 3D 化（Three.js）
- 社区（用户分享起卦心得）

---

## 实施约定

1. **TDD 优先**：所有 lib/ 函数先写测试再写实现
2. **频繁 commit**：每个 Step 完成后立即 commit
3. **每 Phase 结束时验证**：dev / build / test / typecheck 4 个命令全通过
4. **UI 组件先有结构再调样式**：先 markup 正确，再调工笔细节
5. **遇到未决项时**：用最简方案 + TODO 标记，不阻塞

---

## 实施触发方式

**选项 1：Subagent-Driven（推荐）** —— 分派 fresh subagent 逐任务，任务间 review。

**选项 2：Inline Execution** —— 在当前会话中按顺序执行，到 Phase 边界 check in。
