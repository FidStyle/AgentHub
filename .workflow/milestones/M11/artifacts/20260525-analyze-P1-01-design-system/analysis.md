# Analysis: M11 Phase 1 — 设计系统基础设施

## Session Metadata
- **Scope**: Phase (micro mode)
- **Milestone**: M11 — UI 基础设施与设计系统
- **Phase**: 1 — 设计系统基础设施
- **Requirements**: FR-UI-001, FR-DEVICE-001
- **Date**: 2026-05-25

## Current Understanding

### 现状总结

三端 UI 当前处于"毛坯房"状态：
- **Web**: Tailwind CSS 4 已安装（`@tailwindcss/postcss ^4.0.0`），但 `globals.css` 仅一行 `@import 'tailwindcss'`，无设计变量、无语义色。组件使用硬编码 Tailwind class（`bg-gray-50`, `bg-blue-500`），无 shadcn/ui、无 lucide-react、无 class-variance-authority。
- **Desktop**: 组件使用内联 `style={{}}` 对象，完全无 Tailwind。`RuntimeConfigPage.tsx` 暴露 API Key / Base URL 表单（**违反 PRD 契约**）。
- **Mobile**: 仅有 `App.tsx` + `ChatScreen.tsx`，极简骨架。
- **E2E**: Playwright 已配置（Web chromium + Desktop electron），有 fixtures（mock auth）和 3 个 spec 文件。无视觉断言、无布局检查、无截图留存。
- **共享层**: `packages/shared` 仅含 domain types + protocol，无 UI 组件。

### 关键发现

1. **无设计变量系统**: globals.css 空白，无 CSS 变量定义
2. **无基础组件库**: 无 shadcn/ui、无 Button/Card/Input 等可复用组件
3. **无 lucide-react**: 未安装图标库
4. **无状态组件**: 无统一的 Loading/Error/Empty 组件
5. **Desktop 违规**: `RuntimeConfigPage.tsx` 暴露 `ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`Base URL` 表单
6. **E2E 无视觉断言**: 现有测试仅做功能断言，无截图/布局检查
7. **三端样式不统一**: Web 用 Tailwind class，Desktop 用 inline style，Mobile 几乎空白

### 技术栈确认

| 项 | 现状 | 目标 |
|---|---|---|
| CSS 框架 | Tailwind CSS 4 (仅 Web) | 三端统一 Tailwind CSS 4 |
| 组件库 | 无 | shadcn/ui 风格组件 |
| 图标 | 无 | lucide-react |
| 工具函数 | 无 | clsx + class-variance-authority |
| E2E | Playwright (基础) | + 视觉断言 + 截图 |

## Dimension Scoring

| Dimension | Score | Evidence |
|-----------|-------|----------|
| Feasibility | 9/10 | Tailwind 4 已安装，monorepo 结构支持共享，shadcn/ui 可直接落地 |
| Complexity | 4/10 | 纯 UI 层工作，无后端依赖，组件模式成熟 |
| Risk | 3/10 | 低风险——新增组件不影响现有功能逻辑 |
| Impact | 9/10 | 解锁后续 M12-M14 全部 UI 重构工作 |
| Alignment | 10/10 | 直接对应 FR-UI-001 + ui-design-system.md 契约 |
| Readiness | 8/10 | 参考项目 codeg 有完整 shadcn/ui 实现可借鉴 |

## Decisions

| # | Decision | Choice | Source |
|---|----------|--------|--------|
| 1 | 组件放置位置 | `packages/ui/` 新包，三端共享引用 | ui-design-system.md §3.1 |
| 2 | 设计变量方式 | Tailwind CSS 4 `@theme` 块 in globals.css | Tailwind 4 原生方式 |
| 3 | 状态组件范围 | 8 种：空、加载、失败、执行中、待审批、成功、Runtime 未安装、Runtime 未登录 | ui-phase3-task-plan.md §5.1 |
| 4 | E2E 定位点 | data-testid 属性，7 个核心定位点 | ui-phase3-task-plan.md §5.1 |
| 5 | RuntimeConfigPage 处理 | 删除 API Key/Base URL 表单，改为检测+引导 | PRD FR-RUNTIME-001 红线 |
| 6 | Desktop 样式迁移 | 从 inline style 迁移到 Tailwind | ui-design-system.md §3.1 |

## Gray Areas

1. **packages/ui vs apps/web/components/ui**: 是否新建 `packages/ui` 包还是直接在各 app 下建 `components/ui/`？
   - **建议**: 新建 `packages/ui`，三端统一引用。理由：ui-design-system.md 要求"三端共享组件审美"。
   - **风险**: Desktop 是 Electron + Vite，需确认 Tailwind 4 兼容性。

2. **Desktop Tailwind 集成**: Desktop renderer 当前无 Tailwind，需要新增 postcss + tailwind 配置。
   - **建议**: 在 `apps/desktop/src/renderer/` 下新增 postcss.config + globals.css。

## Go/No-Go

**Go** — 高置信度。

理由：
- 技术栈明确（Tailwind 4 + shadcn/ui + lucide-react）
- 参考实现充分（codeg 项目有完整 shadcn/ui 组件）
- 无阻塞依赖
- 现有 E2E 基础可扩展

## Conclusions

```json
{
  "recommendation": "Go",
  "confidence": 92,
  "scope_verdict": null,
  "key_risks": [
    "Desktop Electron renderer 需新增 Tailwind 配置",
    "RuntimeConfigPage 需重构（删除敏感表单）"
  ],
  "next_step": "/maestro-plan 1",
  "decisions_locked": [
    "shadcn/ui + Tailwind CSS 4 + lucide-react 基线",
    "packages/ui 共享组件包",
    "删除 RuntimeConfigPage API Key 表单"
  ],
  "decisions_free": [
    "具体组件 API 设计",
    "状态组件内部实现细节"
  ],
  "decisions_deferred": [
    "暗色模式支持（P1+）"
  ]
}
```
