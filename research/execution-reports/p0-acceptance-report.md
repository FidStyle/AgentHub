# P0 功能验收执行报告

> Session: `ralph-20260527-143500` | Plan: `PLN-p0-acceptance` | 日期: 2026-05-27

## 执行摘要

修复 Desktop 所有 P0 broken 入口点击语义，补全 Mobile 离线提示，新增 19 个 E2E 测试。

## Wave 完成记录

### Wave 1: 统一 Handler 抽取

| Task | 描述 | 状态 |
|------|------|------|
| TASK-001 | 创建 useDesktopAuth hook | ✅ 完成 |
| TASK-002 | 创建 useOpenWebWorkspace hook | ✅ 完成 |

**产出文件:**
- `apps/desktop/src/renderer/hooks/useDesktopAuth.ts` (新建)
- `apps/desktop/src/renderer/hooks/useOpenWebWorkspace.ts` (新建)
- `apps/desktop/src/renderer/store/console-store.ts` (新增 authError/setAuthError)

### Wave 2: Desktop 入口修复

| Task | 描述 | 状态 |
|------|------|------|
| TASK-003 | GitHub 登录按钮绑定 useDesktopAuth | ✅ 完成 |
| TASK-004 | openWebWorkspace 统一 3 处调用 | ✅ 完成 |
| TASK-005 | Agent 选择按钮 + Composer handler | ✅ 完成 |

**产出文件:**
- `apps/desktop/src/renderer/components/shell/DesktopSessionSidebar.tsx`
- `apps/desktop/src/renderer/components/shell/DesktopSettingsPage.tsx`
- `apps/desktop/src/renderer/components/console/StatusBar.tsx`
- `apps/desktop/src/renderer/components/shell/DesktopAgentConfigPanel.tsx`
- `apps/desktop/src/renderer/components/shell/DesktopAgentSession.tsx`

### Wave 3: Mobile 离线提示 + E2E 测试

| Task | 描述 | 状态 |
|------|------|------|
| TASK-006 | Mobile local_desktop 离线提示 | ✅ 完成 |
| TASK-007 | E2E 测试覆盖 | ✅ 完成 |

**产出文件:**
- `apps/web/app/m/page.tsx`
- `e2e/tests/desktop/p0-entry-points.spec.ts` (新建, 8 tests)
- `e2e/tests/web/p0-workspace-flow.spec.ts` (新建, 11 tests)

## 验收结果

| 维度 | 结果 |
|------|------|
| Type-check (desktop) | ✅ 通过 |
| Type-check (web) | ✅ 通过 |
| Convergence criteria | 7/7 全部通过 |
| Quality review | PASS (0 critical/high/medium) |
| E2E 可编译 | 19/19 tests listed |
| Sub-goals | 6/6 全部 met |

## 遗留项（非阻塞）

- Composer 诊断/继续/重试/停止按钮为 disabled 占位（P1，需 runtime invoke 集成）
- URL 硬编码 localhost:3000（后续可通过环境变量配置化）
