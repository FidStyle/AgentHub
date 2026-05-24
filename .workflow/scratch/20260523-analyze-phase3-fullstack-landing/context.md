# Context: Phase 3 全栈落地分析

## Locked Decisions

### D1: Scope = Large
6 独立子系统 + 硬串行依赖链 + 16 P0 FR-IDs。需要完整 roadmap 拆分为 5-8 个 milestone。

### D2: 增量构建
复用现有骨架代码（auth 流程、类型定义、UI 壳子），不重写。

### D3: 技术栈 = Next.js + Supabase + Electron + pnpm monorepo
research/technical-design.md 已收敛，代码已按此搭建。

### D4: 全局中文 UI
所有前端页面文字、交互提示、按钮 100% 使用简体中文。

### D5: 每个 Milestone 必须产出可运行 UI
禁止纯逻辑交付，execute 阶段必须同步产出可视化界面。

### D6: 一键启动脚本
pnpm dev:web / pnpm dev:desktop 必须可真实拉起界面。

## Free Decisions

### Milestone 数量和边界
research/maestro-phase3-roadmap.md 建议 M0-M8，可根据分析结果调整。建议 5-8 个 milestone。

### Mobile 实现方式
technical-design.md 建议 PWA (同一 Next.js 应用的响应式路由)。可在后期决定是否需要 Capacitor。

### Orchestrator 复杂度
先实现简单线性计划，再扩展 Plan DAG。具体边界在 plan 阶段确定。

## Deferred

### P1/P2 需求
FR-IM-101, FR-AGENT-101, FR-WORKSPACE-101, FR-NOTIFY-101, FR-COLLAB-201, FR-MARKET-201, FR-VERSION-201, FR-RUNTIME-201, FR-DOCS-201, FR-PUBLISH-201

### React Native 独立移动端
P0 用 PWA 替代，P1 再评估。

### OpenCode Adapter
P0 只接 Claude Code + Codex。
