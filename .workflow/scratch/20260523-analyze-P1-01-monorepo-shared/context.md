# Context: Phase 1 — Monorepo + Shared Infrastructure

**Date**: 2026-05-23
**Areas discussed**: 仓库结构, 技术选型, 工程配置, 测试基建, UI 壳子

## Interview Decisions

| # | Decision | Choice | Source |
|---|----------|--------|--------|
| 1 | Web 框架 | Next.js 15 App Router | research/technical-design.md |
| 2 | Desktop 框架 | Electron 33 | research/modules/client-shells.md |
| 3 | Mobile 策略 | 同一 Next.js 应用响应式 PWA 路由 | research/modules/client-shells.md |
| 4 | 包管理 | pnpm 9.x workspace | research/technical-design.md |
| 5 | 测试框架 | Vitest | analysis recommendation |
| 6 | CI 平台 | GitHub Actions | analysis recommendation |
| 7 | 样式方案 | Tailwind CSS 4 | analysis recommendation |
| 8 | shared 构建工具 | tsup | analysis recommendation |
| 9 | UI 语言 | 全局中文 | 用户强制标准 |

## Decisions

### Decision 1: Monorepo 结构
- **Context**: 需要支持 Web + Desktop + 共享包的多包项目
- **Options**: 1) pnpm workspace 2) Turborepo + pnpm 3) Nx
- **Chosen**: pnpm workspace（可选加 Turborepo 缓存）
- **Reason**: 最轻量，pnpm 原生支持 workspace，无额外工具依赖

### Decision 2: TypeScript 配置策略
- **Context**: 多包项目需要统一类型检查
- **Options**: 1) project references 2) 单一 tsconfig 3) 各包独立
- **Chosen**: project references + 根 tsconfig.json 继承
- **Reason**: 增量编译 + 跨包类型安全

### Decision 3: Electron 架构
- **Context**: Desktop Connector 需要 Node 能力 + UI
- **Options**: 1) main/preload/renderer 三层 2) main + webview
- **Chosen**: main/preload/renderer 三层分离
- **Reason**: 安全最佳实践，renderer 不直接访问 Node API

## Constraints

### Locked

1. **Web 框架**: Next.js App Router — 不可更改（research/technical-design.md 锁定）
2. **Desktop 框架**: Electron — 不可更改（research/modules/client-shells.md 锁定）
3. **Mobile 策略**: 响应式 PWA — 不可更改（同一 Next.js 应用）
4. **包管理**: pnpm workspace — 不可更改
5. **语言**: TypeScript strict mode — 不可更改
6. **shared 边界**: packages/shared 不依赖 DOM、Electron、Node-only API — 不可更改
7. **UI 语言**: 所有前端显示文字必须 100% 中文 — 用户强制标准
8. **仓库结构**: apps/web, apps/desktop, packages/shared — 不可更改
9. **Electron 安全**: renderer 不直接访问文件系统/shell — 不可更改

### Free

1. **CSS 框架**: 推荐 Tailwind CSS 4，实现者可选其他方案
2. **Linter**: 推荐 ESLint 9 flat config + Prettier
3. **Node 版本**: >= 20.x，具体小版本实现者决定
4. **Electron 构建工具**: 推荐 electron-builder 或 electron-forge
5. **shared 构建**: 推荐 tsup，可选 unbuild 或 tsc 直出
6. **测试覆盖率目标**: Phase 1 不强制覆盖率，但 test harness 必须可运行
7. **Git hooks**: 推荐 husky + lint-staged，实现者可选

### Deferred

1. **Supabase 接入**: Phase 1 只定义类型，不接入 Supabase 服务（→ M2）
2. **状态管理方案**: Web 端状态管理具体方案延迟到 M2 决定（Zustand/Jotai/Redux）
3. **国际化框架**: P0 只做中文，i18n 框架延迟到 P1
4. **Turborepo 缓存**: 可选优化，Phase 1 不强制
5. **Android Capacitor 包装**: 延迟到 M4

## Code Context

### 目标仓库结构（来自 research/technical-design.md §3）

```
apps/
  web/                          # Next.js App Router
    app/                        # 路由和页面
    components/                 # React DOM UI 组件
  desktop/
    src/main/                   # Electron main process
    src/preload/                # typed bridge
    src/renderer/               # Connector Console React UI

packages/
  shared/
    src/domain/                 # Workspace, Session, Message, Artifact, RoleAgent types
    src/protocol/               # DeviceChannel frames, RuntimeEvent, ActionRequest
    src/state-machines/         # message/action/orchestrator/permission states
    src/api-client/             # typed API client
    src/policies/               # execution-domain and permission policy functions
```

### Domain Types 清单（来自 research/technical-design.md §7）

- Workspace（执行域、目录引用、权限策略）
- Device（设备类型、在线状态）
- Session（所属 Workspace、路由模式、状态）
- Message（消息类型、流式状态、正文）
- Artifact（Markdown、代码块、图片、Diff）
- RoleAgent（名称、角色类型、System Prompt、能力标签）
- RuntimeBinding（Runtime 类型、执行域）
- RuntimeSession（native session ID、cwd、能力快照）
- ActionRequest（类型、执行域、风险等级）
- PendingApproval（来源、风险等级、审批状态）
- TaskResult（执行角色、状态、摘要、变更文件）

### FR-ID 常量（Phase 1 scope）

- FR-AUTH-001（types only）
- FR-WS-001（types only）
- FR-DEVICE-001（types only）
- FR-RUNTIME-001（types only）
- FR-PERM-001（policies）
