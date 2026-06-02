# 易象阁 — 64 卦周易研究网站

> 一个以《周易》六十四卦为核心内容，以精致国风动漫（工笔重彩 + 现代极简）为视觉形式，结合用户地区日期生成"今日卦境"、支持"三数起卦"和 AI 深度解读的周易文化研究与自我反思网站。

## 状态

- **Phase:** 0 — 项目准备就绪
- **Spec:** `docs/superpowers/specs/2026-06-02-zhouyi-website-design.md`
- **Plan:** `docs/superpowers/plans/2026-06-02-zhouyi-website-mvp.md`
- **Visual samples:** `.superpowers/brainstorm/367-1780359645/content/*.html`

## 技术栈

- Vite 5 + React 18 + TypeScript
- Tailwind CSS 3
- Framer Motion 11
- React Router 6
- Zustand（状态管理）
- LocalStorage（无后端，MVP 阶段）

## 开发命令

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器
npm run build      # 生产构建
npm run preview    # 预览生产构建
npm run test       # 运行单元测试
npm run typecheck  # TypeScript 类型检查
```

## 目录结构

```
src/
├── types/        # TypeScript 类型定义
├── data/         # 64 卦 JSON 数据
├── lib/          # 业务逻辑（算法、存储、AI）
├── components/   # UI 组件
│   ├── hexagram/ # 卦象相关组件
│   ├── layout/   # 页面布局
│   ├── motion/   # 动效封装
│   ├── ui/       # 通用 UI
│   └── sections/ # 页面区块
├── pages/        # 页面
├── store/        # Zustand store
├── styles/       # 全局样式
└── utils/        # 工具函数
```

## License

© 2026 易象阁项目组
