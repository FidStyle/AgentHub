# Context: M11 Phase 1 — 设计系统基础设施

## Interview Decisions

| # | Decision | Choice | Source |
|---|----------|--------|--------|
| 1 | Mode | Micro (phase-level) | auto: numeric arg "1" |
| 2 | Depth | Standard | auto: -y flag |
| 3 | Scope | Phase 1 of M11 | state.json current_milestone |

## Locked Decisions

- **L1**: 组件技术栈 = shadcn/ui 风格 + Tailwind CSS 4 + lucide-react + clsx + class-variance-authority
- **L2**: 共享组件位置 = `packages/ui/` 新包，三端通过 workspace 引用
- **L3**: 设计变量 = Tailwind CSS 4 `@theme` 块定义语义色（background, foreground, card, border, muted, primary, destructive, success, warning, info）
- **L4**: 状态组件 = 8 种基础状态（空、加载、失败、执行中、待审批、成功、Runtime 未安装、Runtime 未登录）
- **L5**: E2E 定位点 = data-testid 属性，核心 7 个：workspace-shell, chat-panel, message-composer, artifact-panel, connector-console, runtime-status-card, mobile-session
- **L6**: Runtime 边界 = 删除 RuntimeConfigPage 中 API Key/Base URL 表单，改为纯检测+引导
- **L7**: Desktop 样式 = 从 inline style 迁移到 Tailwind CSS 4
- **L8**: 文案语言 = 全部用户可见文案使用简体中文

## Free Decisions (plan 阶段决定)

- 具体组件 API 设计（props 接口）
- 状态组件内部动画/过渡效果
- 图标按钮 tooltip vs aria-label 具体选择
- packages/ui 的 exports 粒度

## Deferred Decisions

- 暗色模式支持（P1+ 阶段）
- 组件文档/Storybook（非 P0）

## Key Context for Plan

### 现有代码锚点

| 文件 | 状态 | 动作 |
|------|------|------|
| `apps/web/app/globals.css` | 仅 `@import 'tailwindcss'` | 扩展：添加 @theme 设计变量 |
| `apps/web/postcss.config.mjs` | 已配置 @tailwindcss/postcss | 保持 |
| `apps/web/components/layout/Sidebar.tsx` | 硬编码 Tailwind class | 后续 M12 重构 |
| `apps/desktop/src/renderer/` | 无 Tailwind，inline style | 新增 postcss + globals.css |
| `apps/desktop/src/renderer/components/RuntimeConfigPage.tsx` | 暴露 API Key 表单 (314行) | **重构：删除敏感表单** |
| `apps/mobile/src/` | 极简骨架 | 新增 Tailwind 配置 |
| `e2e/playwright.config.ts` | 基础配置 | 扩展：视觉断言 helper |
| `e2e/tests/fixtures.ts` | mock auth | 扩展：截图/布局 helper |
| `packages/shared/` | domain types only | 不动 |

### 依赖需新增

```
packages/ui/package.json:
  - lucide-react
  - class-variance-authority
  - clsx
  - tailwind-merge (可选)

apps/desktop/package.json:
  - @tailwindcss/postcss
  - tailwindcss
```

### 参考实现

- `refer_proj/codeg/src/components/ui/button.tsx` — shadcn Button 实现
- `refer_proj/codeg/src/components/ui/card.tsx` — shadcn Card 实现
- `refer_proj/codeg/src/components/ui/badge.tsx` — shadcn Badge 实现
- `refer_proj/codeg/postcss.config.mjs` — PostCSS 配置参考
