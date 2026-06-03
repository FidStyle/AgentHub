# ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03: 角色 Runtime Workspace 隔离与权限 Broker 回归合同

> 本合同是 Trellis 与 Maestro/Ralph 的共享事实接口。实现、测试、验收和执行报告都必须引用本文件。

---

## 1. 元信息

| 字段 | 内容 |
| --- | --- |
| TASK-ID | `ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03` |
| 优先级 | `P0` |
| 绑定 FR-ID | `FR-CHAT-001`, `FR-ORCH-001`, `FR-AGENT-001`, `FR-RUNTIME-001`, `FR-PERM-001`, `FR-WS-001`, `FR-ACTION-001`, `FR-UI-001` |
| 来源 | `bytedance_init_prd.md`, `bytedance_init_video_txt.txt`, `research/prd.md`, `research/modules/orchestrator.md`, `research/modules/orchestrator-plan-dag.md`, `research/modules/action-cli-adapter.md`, `research/contracts/COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02.md`, `research/contracts/ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03.md`, `.trellis/spec/cross-layer/real-flow-acceptance.md`, `.trellis/spec/cross-layer/parallel-worktree-testing.md` |
| 负责人角色 | Codex 总控创建合同和验收；实现 lane 建议使用 `feature/role-runtime-workspace-permissions`；Trellis 管实现规范和检查 |
| 状态 | `active` |

---

## 2. 背景与目标

用户在 cloud workspace 中向 `@架构师` 提出普通建站需求时，业务角色必须只理解和操作该 cloud workspace，不能把 AgentHub 宿主开发仓库当成用户项目，也不能绕过产品权限确认直接执行工具。

验收样本 workspace：

```text
/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2
```

用户需求：

```text
做一个加减乘除的简单网站，使用sqlite存储历史记录
```

目标是修复并证明：

- `runtime_sessions.cwd`、worker job cwd、CLI spawn cwd 都等于用户 cloud workspace root。
- 业务角色可见上下文不包含宿主 AgentHub repo 的 `AGENTS.md`、Trellis、package、monorepo 技术栈判断。
- `@架构师` 遇到需要工程执行的需求时，必须产生可见派发事件或 plan/mailbox，并派发前端/后端等角色。
- Claude/Codex native CLI 工具行为必须进入产品 permission broker。
- 未授权不得执行；授权后动作仍限制在 cloud workspace root 内。

---

## 3. 用户链路合同

1. 用户进入 Web 的 cloud workspace session，workspace root 指向 `test2-e427fab2`。
2. 用户在 IM 中发送：`做一个加减乘除的简单网站，使用sqlite存储历史记录`，并 `@架构师` 或选择架构师角色。
3. 系统创建 runtime session / plan / mailbox 或等价 durable record，记录 workspace root。
4. `@架构师` 读取的 visible files 只能来自 `test2-e427fab2`；可看到 README 中的 `AgentHub cloud workspace project.`，但不得推断宿主 AgentHub 技术栈。
5. 架构师判断需求涉及前端页面和 SQLite 持久化，产生可见派发事件或 plan/mailbox，把任务派给后端角色，必要时同时派给前端角色。
6. 后续角色如要写文件、安装依赖、启动服务、访问网络或访问 workspace 外路径，系统必须产生 permission event。
7. 用户拒绝授权时，对应动作不执行；用户批准后，动作只能在 `test2-e427fab2` 内执行。
8. 刷新或查看报告后，能读回 cwd、context payload、tool calls、approval events、role dispatch events、plan/mailbox/runtime ids。

完成条件：真实用户从 Web 入口能看到架构师没有误判宿主仓库、角色派发可见、权限确认可交互、执行边界可审计。

---

## 4. 三端职责边界

| 端 | 职责 | 不做什么 |
| --- | --- | --- |
| Web | IM 入口、角色选择、派发事件/plan/mailbox 展示、权限卡、测试报告入口 | 不把权限确认降级为 Markdown 文本；不把宿主 repo 信息注入业务角色 |
| Desktop | 本地 workspace root、文件系统、CLI spawn、工具权限执行和越界拦截 | 不绕过 permission broker；不把 cwd fallback 到 AgentHub 宿主 repo |
| Mobile/PWA | 查看角色状态、审批/拒绝权限、查看产物和错误态 | 不执行本地文件写操作；不隐藏权限风险 |

---

## 5. 数据与后端合同

### 5.1 Runtime cwd contract

```typescript
type RuntimeSessionWorkspaceBinding = {
  runtimeSessionId: string
  workspaceId: string
  sessionId: string
  roleAgentId?: string
  cwd: string
  workspaceRoot: string
  source: 'cloud_workspace'
}
```

硬规则：

- `cwd === workspaceRoot`。
- `cwd` 必须是用户 cloud workspace root，例如 `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`。
- 禁止 fallback 到 AgentHub 宿主 repo、当前开发者 shell cwd 或任意 worktree。
- worker job payload、runtime session record、CLI spawn options 必须携带并使用同一个 cwd。

### 5.2 Context isolation contract

```typescript
type RoleContextPayload = {
  workspaceId: string
  sessionId: string
  workspaceRoot: string
  visibleFiles: string[]
  injectedContextSources: Array<'workspace_readme' | 'workspace_files' | 'role_profile' | 'user_message' | 'plan_context'>
}
```

规则：

- `visibleFiles` 必须限制在 workspace root 内的相对路径。
- 不得注入宿主 AgentHub 的 `AGENTS.md`、`.trellis/*`、`package.json`、monorepo summary、开发者 Codex session context。
- 允许注入产品角色配置和用户消息，但必须标明来源。

### 5.3 Role dispatch contract

```typescript
type RoleDispatchEvent = {
  id: string
  workspaceId: string
  sessionId: string
  sourceRoleAgentId: string
  targetRoleAgentIds: string[]
  reason: string
  delivery: 'plan_node' | 'mailbox_item' | 'visible_handoff'
  createdAt: string
}
```

规则：

- 单独 `@架构师` 不能只是 direct chat。
- 当需求需要工程执行时，必须产生 durable 派发事件或 plan/mailbox。
- SQLite 持久化需求至少触发后端角色；页面交互需求应触发前端角色或明确说明同一工程角色承担前端。

### 5.4 Permission broker contract

```typescript
type ToolApprovalEvent = {
  id: string
  workspaceId: string
  sessionId: string
  runtimeSessionId: string
  roleAgentId: string
  actionKind: 'file_write' | 'dependency_install' | 'service_start' | 'network_request' | 'outside_workspace_access' | 'destructive_command'
  command?: string
  path?: string
  status: 'pending' | 'approved_once' | 'rejected' | 'expired'
  workspaceRoot: string
  createdAt: string
  decidedAt?: string
}
```

规则：

- 未授权动作不得执行。
- 授权后也必须限制在 `workspaceRoot` 内，除非另有显式 outside-workspace approval。
- 写文件、安装依赖、启动服务、网络请求、workspace 外路径访问、破坏性命令至少必须覆盖。
- 端口相关服务启动必须使用 `.trellis/spec/cross-layer/parallel-worktree-testing.md` 中分配的显式端口；本 lane 使用 `3106`。

产品运行时是否允许 mock 主链路数据：**否**。

---

## 6. UI/UX 合同

- 架构师回复必须基于当前 workspace 可见事实，不得出现宿主仓库技术栈判断，例如 `Next.js 15`、`React 19`、`Drizzle`、`Postgres`、`next-auth`。
- 派发事件必须用户可见，文案示例：
  - `架构师：这个需求需要页面和 SQLite 持久化，我会派发给后端工程师，并同步前端工程师处理交互页面。`
  - `后端工程师：收到，我会在当前 workspace 内实现 SQLite 历史记录 API。`
- 权限确认必须是结构化卡片，包含动作类型、路径/命令、workspace root、风险、允许/拒绝按钮。
- 拒绝授权时显示中文状态：`已拒绝，未执行该操作。`
- 越界访问时显示中文错误：`该操作试图访问 workspace 外路径，已阻止。`

---

## 7. 参考项目输入

| 参考项目 | 读取范围 | 提炼内容 | 不采用内容 |
| --- | --- | --- | --- |
| Temporal / Inngest / Hatchet / LangGraph / AutoGen 调研 | 仅调度、HITL、审批、durable event 模式 | durable dispatch、approval pause、attempt lineage 的模式参考 | 不替换 AgentHub 产品 DB 真相源 |

---

## 8. Trellis 派生要求

- `.trellis/tasks/<task>/prd.md`：必须引用本合同。
- `implement.jsonl`：必须包含本合同、`.trellis/spec/cross-layer/real-flow-acceptance.md`、`.trellis/spec/cross-layer/parallel-worktree-testing.md`、相关 runtime/orchestrator spec。
- `check.jsonl`：必须包含本合同和同一 cross-layer spec。
- 需要更新的 `.trellis/spec/*`：如实现发现新的 cwd、context 或 permission broker 边界，必须用 `trellis-update-spec` 追加 code-spec。

---

## 9. Maestro/Ralph 派生要求

- 推荐 worktree：`feature/role-runtime-workspace-permissions`。
- 推荐端口：`3106`，所有 dev/E2E/OpenCLI/UAT 命令必须显式使用 `http://127.0.0.1:3106`。
- analyze/plan 不得把用户已知的具体根因硬编码成唯一答案；必须从 cwd、context payload、tool calls、approval events、role dispatch records 自行定位。
- execute 必须按最小闭环推进：cwd 绑定 -> context 隔离 -> role dispatch -> permission broker -> 验收样本。
- execution report 路径建议：`research/execution-reports/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md`。

---

## 10. 测试与验收合同

自动化测试必须覆盖：

- Type-check：受影响 packages 通过。
- Integration：runtime session / worker job / CLI spawn cwd 等于 cloud workspace root。
- Context isolation：visible files 只包含 workspace 内文件；context payload 不含宿主 repo 文件。
- Role dispatch：SQLite 网站需求触发后端角色，必要时同时触发前端角色；有 durable dispatch event 或 plan/mailbox。
- Permission broker：写文件、安装依赖、启动服务、网络请求、workspace 外路径访问、破坏性命令的 allow/reject 至少覆盖关键路径。
- Web E2E / OpenCLI：从真实 IM 入口发验收样本，截图和事件证据证明没有宿主技术栈误判。
- 并行端口：本 lane 使用 `PORT=3106`、`BASE_URL=http://127.0.0.1:3106`，报告不得使用默认端口。

人工验收路径：

1. 打开 `test2-e427fab2` 对应 cloud workspace session。
2. 发送 `做一个加减乘除的简单网站，使用sqlite存储历史记录` 给 `@架构师`。
3. 确认架构师没有提 AgentHub monorepo / Next.js 15 / React 19 / Drizzle / Postgres / next-auth。
4. 确认出现角色派发事件，至少覆盖后端，必要时覆盖前端。
5. 对写文件或安装依赖先拒绝一次，确认未执行；再允许一次，确认只在 workspace root 内执行。

---

## 11. 计划阶段禁止项

- 不得用 mock runtime、mock permission event 或 hardcoded response 证明通过。
- 不得只检查 UI 文案而不验证 runtime session cwd、worker job cwd、CLI spawn cwd。
- 不得把 README 中的 `AgentHub cloud workspace project.` 扩展成宿主 AgentHub monorepo 技术判断。
- 不得裸跑默认端口命令；本 lane 必须显式使用 `3106`。
- 不得把 direct chat 回复当作架构师派发完成。

---

## 12. 验真样本

| 样本 | 只给执行者的合同描述 | 不应预置的答案 | 通过标准 |
| --- | --- | --- | --- |
| 空 cloud workspace SQLite 计算器需求 | 在 `test2-e427fab2` 中让架构师分析并派发工程角色，工具动作走权限确认 | 不预置“cwd fallback 到宿主 repo”作为唯一根因 | 执行系统自行提供 cwd、visible files、context payload、tool calls、approval events、dispatch events 和 durable ids 证据 |

---

## 13. 完成门禁

- [ ] `research/project-tracker.md` 或 regression ledger 已记录该 P0 回归和关闭状态。
- [ ] execution report 写明 `PORT=3106`、`BASE_URL`、cwd、visible files、context payload、tool calls、approval events、role dispatch events、plan/mailbox/runtime ids。
- [ ] 自动化测试和人工验收路径均有结果；跳过项不得计入通过。
- [ ] `trellis-check` 通过。
- [ ] 必要的新工程规则已通过 `trellis-update-spec` 沉淀。
- [ ] 精确 commit，禁止 `git add .`。
- [ ] Codex 总控按本合同独立验收。

---

## 14. 残留风险与后续

- 后续如引入并行写 workspace，必须先有 lane/worktree 隔离和写操作 lease，不能复用本合同的串行假设。
- 如果原生 Claude/Codex CLI 无法细粒度拦截所有工具动作，必须在产品层记录不可覆盖范围，并把对应权限能力标记为未验收。
