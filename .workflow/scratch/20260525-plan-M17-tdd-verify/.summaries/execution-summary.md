# M17 TDD 验证补全 - 执行摘要

## 执行结果

**50 tests passed** across 3 projects (web-desktop, web-tablet, mobile-pwa)

## Wave 1: 设计系统 TDD 验证 (TASK-001 ~ TASK-004) ✅

### TASK-001: 基础组件渲染测试
- Button, Card, Input, IconButton 各有独立渲染测试
- 截图保存至 `e2e/artifacts/design-system/`

### TASK-002: CSS 设计变量断言
- 验证 Tailwind CSS 4 @theme 编译后样式生效
- Button border-radius 非零（设计系统圆角生效）
- body 背景色已应用

### TASK-003: StateCard 全状态覆盖
- 扩展 StateCard 从 8 → 10 种变体
- 新增: `offline`（设备离线）、`not-logged-in`（未登录）
- 所有变体有 data-testid 和中文默认文案

### TASK-004: 定位点 + IconButton 中文 aria-label
- workspace-shell, chat-panel, session-list, artifact-panel, message-composer 全部验证
- IconButton aria-label 正则匹配中文字符

## Wave 2: 三端页面 TDD 验证 (TASK-005 ~ TASK-008) ✅

### TASK-005: Web 三栏深度交互
- 1440x900 三栏不重叠 + 无横滚
- 1024x768 平板视口无横滚
- 消息输入框交互（选会话→输入→发送）
- 右栏折叠功能

### TASK-006: Desktop (via web-desktop project)
- 无敏感字段（API Key/Base URL/sk-）
- 状态卡不重叠

### TASK-007: Mobile/PWA 深度交互
- 390x844 无横滚
- mobile-session 定位点存在
- 审批页可导航
- 中文 UI 验证

### TASK-008: 全局中文文案扫描
- button/label/placeholder 英文文案扫描
- 允许列表: Runtime, Agents, Claude, AgentHub, API 等技术术语
- 扫描通过，无违规英文文案

## 修复的问题

1. **Import 路径修复**: `tests/web/` 和 `tests/mobile/` 中 visual-assertions 导入路径从 `../helpers/` 修正为 `../../helpers/`
2. **Artifact 目录修复**: 截图输出路径从 `../artifacts/` 修正为 `../../artifacts/`
3. **Auth fixture 统一**: 所有需要认证的测试统一使用 `authedPage` fixture
4. **Input 测试修复**: 消息输入框需先选中会话才能启用

## 文件变更

| 文件 | 变更 |
|------|------|
| `packages/ui/src/components/state-card.tsx` | +2 variants (offline, not-logged-in) |
| `e2e/tests/design-system.spec.ts` | 重写为 17 个测试 |
| `e2e/tests/web-workbench.spec.ts` | 迁移到 auth fixture |
| `e2e/tests/web/visual-gate.spec.ts` | 修复导入 + auth + 中文扫描 |
| `e2e/tests/mobile/mobile-pwa.spec.ts` | 迁移到 auth fixture |
| `e2e/tests/mobile/visual-gate.spec.ts` | 修复导入 + auth |

## Wave 3: refer_proj 对照审计 (TASK-009) — 待执行

需要读取 refer_proj/ 下的参考项目源码进行对照分析。
