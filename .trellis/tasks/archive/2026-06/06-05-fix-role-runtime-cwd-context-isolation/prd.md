# 修复 role runtime cwd 与上下文隔离

## Goal

修复 cloud workspace role runtime 的执行目录与上下文来源，确保 `/api/chat`、runtime session、worker job、CLI spawn 和业务角色可见上下文都绑定到用户选中的 cloud workspace root，而不是 AgentHub 宿主 repo、当前 shell cwd、旧 worktree 或 Trellis 项目上下文。

## What I Already Know

- 顺序队列第 2 项已经同步旧 lane 事实：旧 `role-runtime-workspace-permissions` 只有合同级测试证据，没有真实 OpenCLI 三端 UAT。
- 本任务是第 3 项，只处理 `cwd` 绑定与 context isolation。
- 后续第 4 项才处理 `@架构师` durable dispatch；第 5 项才处理 permission broker；第 6 项才跑固定样本三端 OpenCLI UAT。
- 固定验收 workspace root：
  `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`
- 固定验收 prompt：
  `做一个加减乘除的简单网站，使用sqlite存储历史记录`
- 业务角色上下文不得包含或推断：
  - AgentHub 宿主 repo
  - `.trellis` / Trellis task context
  - `AGENTS.md`
  - monorepo/package manager metadata from the host project
  - `Next.js 15`, `React 19`, `Drizzle`, `Postgres`, `next-auth` 等宿主技术栈判断

## Requirements

- `/api/chat` 或等价 chat runtime entry 必须从 selected workspace 解析 cloud workspace root。
- `runtime_sessions.cwd` 必须等于 selected workspace root。
- worker job payload 的 `cwd` 必须等于同一个 selected workspace root。
- native CLI spawn cwd 必须来自 runtime job/session cwd，不得 fallback 到 `process.cwd()` 或 repo root。
- Context Package / prompt context 只能包含 selected workspace root 内的相对文件或明确产品角色/用户消息来源。
- file candidates 中出现宿主 repo 文件、绝对外部路径、路径穿越时必须过滤，不能进入 visible files 或 injected context。
- Runtime 不知道 selected workspace root 时必须返回显式错误或阻断，不得降级到宿主 repo。
- 补受影响 package 的 unit/API/runtime worker 测试，至少覆盖：
  - cloud workspace root 解析。
  - runtime session cwd。
  - worker job cwd。
  - host repo cwd/path 被拒绝或过滤。
  - context payload 不含宿主技术栈判断。

## Acceptance Criteria

- [ ] 自动化测试证明 fixed sample workspace root 进入 runtime session 和 worker job cwd。
- [ ] 自动化测试证明 context visible files 只包含 workspace 内相对路径。
- [ ] 自动化测试证明 host repo `AGENTS.md`、`.trellis`、`package.json`、Next.js/React/Drizzle/Postgres/next-auth 等宿主上下文不会进入业务角色 context。
- [ ] 受影响 package 的 type-check 和 tests 通过。
- [ ] `research/sequential-execution-progress.md` 和 `research/project-tracker.md` 更新本任务状态、证据和下一步。
- [ ] 不把本任务写成 OpenCLI UAT 通过；三端 OpenCLI 仍留给 `06-05-opencli-role-runtime-uat`。

## Out of Scope

- 不修 durable architect dispatch。
- 不修 permission broker 卡片和 allow/reject 行为。
- 不跑最终三端 OpenCLI UAT。
- 不用 fake/script runtime 证明真实 Agent 能力。

## Technical Notes

- 合同：`research/contracts/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md`
- Backend spec：`.trellis/spec/backend/runtime-workspace-contract.md`
- Real-flow spec：`.trellis/spec/cross-layer/real-flow-acceptance.md`
- 旧失败/未验收事实报告：`research/execution-reports/role-runtime-opencli-failure-evidence-2026-06-05.md`
