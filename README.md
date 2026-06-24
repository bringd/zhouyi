# 易象阁 — 64 卦周易研究网站

> 一个以《周易》六十四卦为核心内容，以精致国风动漫（工笔重彩 + 现代极简）为视觉形式，结合用户地区日期生成"今日卦境"、支持"三数起卦"和 AI 深度解读的周易文化研究与自我反思网站。

## 项目状态

- **Phase:** MVP 96% 完成
- **设计规格:** [`docs/superpowers/specs/2026-06-02-zhouyi-website-design.md`](docs/superpowers/specs/2026-06-02-zhouyi-website-design.md)
- **实施计划:** [`docs/superpowers/plans/2026-06-02-zhouyi-website-mvp.md`](docs/superpowers/plans/2026-06-02-zhouyi-website-mvp.md)
- **设计决策样例:** `.superpowers/brainstorm/367-1780359645/content/*.html`
- **进度:** 44/46 任务、205/205 tests pass、45 commits

## 技术栈

| 层 | 选型 |
|---|---|
| 前端构建 | Vite 5 |
| 前端框架 | React 18 + TypeScript 5 |
| 前端样式 | Tailwind CSS 3（设计 tokens 通过 `tailwind.config.ts` 注入）|
| 前端动画 | Framer Motion 11 |
| 前端路由 | React Router 6 |
| 前端状态 | Zustand 4 |
| 前端测试 | Vitest + @testing-library/react |
| 前端 SEO | react-helmet-async + 自动 sitemap |
| **后端框架** | **Node.js + Express + TypeScript** |
| **数据库** | **PostgreSQL + Drizzle ORM** |
| **AI 集成** | **后端代理 Claude API + IP 限流** |
| **离线缓存** | **LocalStorage**（前端） |
| 部署 | 暂未决定（云服务器 / PaaS 备选） |

## 快速开始

```bash
# 安装全部依赖（根 + server）
npm install
cd server && npm install && cd ..

# 启动前端（http://localhost:5173）
npm run dev

# 启动后端（http://localhost:3001，需 Postgres）
npm run server:dev

# 同时启动
npm run dev:all

# 测试
npm test
npm run typecheck

# 构建
npm run build
```

> **后端配置：** 启动后端前需在 `server/.env` 设置 `DATABASE_URL` 和 `ANTHROPIC_API_KEY`。参考 `server/.env.example`。

## 目录结构

```
src/
├── types/        # TypeScript 类型定义
│   ├── trigram.ts
│   ├── hexagram.ts
│   ├── record.ts
│   └── index.ts
├── data/         # 64 卦静态数据
│   ├── trigrams.json      # 8 卦基础数据
│   ├── hexagrams.json     # 64 卦完整内容
│   └── relationships.json # 卦象关系索引
├── lib/          # 业务逻辑（纯函数，单元测试覆盖）
│   ├── divination.ts      # 三数起卦算法
│   ├── daily.ts           # 今日卦境生成
│   ├── relations.ts       # 错/综/互/变 计算
│   ├── ai.ts              # AI 解读调用
│   └── storage.ts         # LocalStorage 封装
├── components/   # UI 组件
│   ├── hexagram/          # 卦象卡、爻线渲染
│   ├── layout/            # Header / Footer / PageLayout
│   ├── motion/            # 动效封装（呼吸、翻转）
│   ├── ui/                # 通用 UI（按钮、卡片、印章）
│   └── sections/          # 页面区块（DailyHero、CodexGrid 等）
├── pages/        # 路由页面
│   ├── Home.tsx           # 易象阁首页（今日卦境）
│   ├── Codex.tsx          # 64 卦图鉴
│   ├── HexagramDetail.tsx
│   ├── Divination.tsx     # 三数起卦
│   ├── Result.tsx         # 起卦结果
│   ├── Records.tsx        # 我的卦册
│   └── NotFound.tsx
├── store/        # Zustand store
│   └── useStore.ts
├── styles/       # 全局样式
│   ├── tokens.css         # CSS 变量（矿物质色、字体、间距）
│   └── global.css         # Tailwind 入口 + 基础重置
├── utils/        # 工具函数
│   └── cn.ts              # clsx wrapper
├── App.tsx       # 路由根
└── main.tsx      # 应用入口

tests/
├── setup.ts               # Vitest 全局配置
├── lib/                   # 业务逻辑测试
└── components/            # 组件测试
```

## 设计系统

### 矿物质色（5 种主色 + 5 种辅助色）

| Token | 色值 | 用途 |
|---|---|---|
| `--color-june-red` | `#9B2C2C` | 朱砂 · 主色 |
| `--color-june-gold` | `#C89E3A` | 藤黄 · 强调 |
| `--color-june-bronze` | `#8B6914` | 赭石 · 描边 |
| `--color-june-jade` | `#4A5A4A` | 石绿 · 辅助 |
| `--color-june-clay` | `#6B4A2A` | 赭褐 · 阴影 |
| `--color-rice` | `#FAF6EC` | 宣纸 · 页面背景 |
| `--color-rice-dark` | `#EDE2D0` | 旧纸 · 卡片背景 |
| `--color-ink` | `#1A1A1A` | 浓墨 · 正文 |
| `--color-ink-light` | `#4A371C` | 淡墨 · 副文 |

### 字体

- **Display（标题）**：思源宋体
- **Body（正文）**：霞鹜文楷
- **Num（数字）**：JetBrains Mono

## 开发约定

1. **TDD 优先**：所有 `lib/` 下的纯函数都先写 Vitest 测试再写实现
2. **频繁 commit**：每个 Step 完成后立即 commit
3. **每 Phase 结束时验证**：`dev / build / test / typecheck` 4 个命令全通过
4. **UI 组件先有结构再调样式**：先 markup 正确，再调工笔细节
5. **路径别名**：`@/*` 指向 `src/*`

## 视觉决策样例

本次 brainstorming 过程中生成的所有图形化样例（CSS + SVG mockup）保存在：
`.superpowers/brainstorm/367-1780359645/content/`

包含 13 个样例 HTML，涵盖视觉风格、动效、图鉴排版、起卦交互等所有关键决策。

## 实施进度

| Phase | 任务 | 状态 |
|---|---|---|
| Phase 1: 项目基础设施 | Tasks 1-5 | ✅ 已完成 |
| Phase 2: 设计系统 | Tasks 6-9 | ⏳ |
| Phase 3: 数据层 | Tasks 10-14 | ⏳ |
| Phase 4: 业务逻辑 | Tasks 15-19 | ⏳ |
| Phase 5: UI 组件 | Tasks 20-28 | ⏳ |
| Phase 6: 页面 | Tasks 29-36 | ⏳ |
| Phase 7: AI 与存储 | Tasks 37-39 | ⏳ |
| Phase 8: 打磨上线 | Tasks 40-46 | ⏳ |

## License

© 2026 易象阁项目组
