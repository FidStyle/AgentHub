# 修复 role runtime workspace 权限隔离

## Goal

修复 Role Runtime 从 `/api/chat` 到 Runtime Adapter 的 workspace 隔离链路，确保 selected workspace 决定 cloud workspace root、runtime session cwd、worker job cwd、CLI spawn cwd 和可见上下文。权限敏感工具调用必须进入产品 permission broker；架构师在工程执行需求下必须产生可见派发，而不是只进行 direct chat。

## What I Already Know

- 当前 worktree 是 `feature/role-runtime-workspace-permissions`。
- 验收 workspace root 是 `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`。
- 验收用户需求是 `做一个加减乘除的简单网站，使用sqlite存储历史记录`。
- 运行时不能 fallback 到 AgentHub 宿主 repo。
- 业务角色不能继承宿主 `AGENTS.md`、Trellis、package、monorepo 语境。
- 固定验收端口为 `3106`；默认端口或自动跳端口结果不能作为最终验收证据。
- 仓库当前是 Phase 3 骨架：shared domain 已有 Workspace、Runtime、Plan DAG、Approval 类型，Desktop 有 CLI command plan；没有真实 `/api/chat` route 目录，因此本任务先在 shared contract 与 tests 中固化跨层行为。

## Requirements

- FR-ID：`FR-WS-001`、`FR-RUNTIME-001`、`FR-CTX-001`、`FR-ORCH-001`、`FR-PERM-001`、`FR-ACTION-001`、`NFR-SEC-001`、`NFR-OBS-001`。
- `/api/chat` 的 selected workspace 必须解析出 `cloud_project_dir` / workspace root，并传入 runtime invocation。
- `runtime_sessions.cwd`、worker job cwd、CLI spawn cwd 必须等于用户 cloud workspace root。
- Context Package 只包含 workspace root 内可见文件，不能包含宿主 AgentHub repo 上下文判断。
- 单独 `@架构师` 遇到工程执行需求时，必须产生结构化 plan/mailbox/dispatch event，并派发后端角色；涉及 UI 时同时派发前端角色。
- Claude/Codex native CLI 工具行为必须经过产品 permission broker，至少覆盖写文件、安装依赖、启动服务、网络请求、workspace 外路径访问、破坏性命令。
- 未授权不得执行；授权后动作必须仍限制在 workspace root 内。

## Acceptance Criteria

- [ ] 验收样本生成的 `runtime_sessions.cwd` 等于 `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`。
- [ ] CLI visible files 只包含该 workspace 内相对路径。
- [ ] 架构师 context/回复不得出现 AgentHub monorepo、Next.js 15、React 19、Drizzle、Postgres、next-auth 等宿主判断。
- [ ] 需求触发后端角色，必要时同时触发前端角色。
- [ ] 写文件、安装依赖、启动服务、网络请求、workspace 外路径访问、破坏性命令都产生 permission event。
- [ ] 拒绝授权时不执行；授权后只允许 workspace root 内执行。
- [ ] 测试报告记录 cwd、visible files、context payload、tool calls、approval events、role dispatch events、plan/mailbox/runtime ids。
- [ ] 若运行端到端或服务测试，最终验收必须使用固定 `baseUrl` / port：`http://127.0.0.1:3106`。

## Out of Scope

- 不在本任务实现真实生产数据库 schema 或持久化迁移。
- 不把当前骨架仓库改造成完整后端服务；没有真实 route 时以 shared contract 和可执行测试锁定 `/api/chat` 行为。
- 不接入真实 Claude/Codex CLI 登录态或真实外部网络执行。

## Technical Notes

- Orchestrator 结论来自 `research/modules/orchestrator.md`：LLM 生成候选计划，系统负责 DAG 校验、状态推进、权限判断和 ready 节点分派。
- Runtime Adapter 结论来自 `research/modules/runtime-adapters.md`：Runtime 输入必须结构化，`runtime_sessions` 至少记录 `workspaceId/sessionId/roleAgentId/runtimeKind/executionDomain/cwd/nativeSessionId/capabilities/status`；Codex approval 和 Claude/Codex tool calls 必须归一化为一等事件。
- 本任务合同见 `research/contracts/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md`。
