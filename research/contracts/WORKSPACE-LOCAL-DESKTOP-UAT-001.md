# WORKSPACE-LOCAL-DESKTOP-UAT-001: Web Workspace 与 Desktop 本地连接真实可用性修复共享合同

> 本合同是 Trellis 本次实现的共享事实接口。实现、测试、验收和最终报告都必须引用本文件。

---

## 1. 元信息

| 字段 | 内容 |
| --- | --- |
| TASK-ID | `WORKSPACE-LOCAL-DESKTOP-UAT-001` |
| 优先级 | P0 |
| 绑定 FR-ID | FR-WEB-001, FR-WS-001, FR-CHAT-001, FR-RUNTIME-001, FR-DESKTOP-001, FR-DEVICE-001, FR-UI-001 |
| 来源 | 用户验收反馈（2026-05-31）；`research/prd.md`；`research/product-design.md`；`research/contracts/P0-END-TO-END-PRODUCT-FLOW.md`；`research/contracts/P1-RUNTIME-GATEWAY.md`；`research/regression-ledger.md`；`research/project-tracker.md` |
| 执行方式 | Trellis / Codex inline，不使用 Maestro/Ralph |
| 状态 | active |

---

## 2. 背景与目标

用户在真实 Web 3000 workspace 与 Desktop dev 环境中发现多个核心可用性缺口：

- Web 编排面板显示“加载编排数据失败”，没有区分空态、未初始化和接口错误。
- Workspace 内 Agents 只有默认“架构师”，用户无法在当前工作区路径中完成创建、编辑、删除、设为编排者。
- 用户无法从工作区内部返回“我的工作区”。
- Workspace 内看不到登录状态、本地 Desktop 连接状态、本地 Runtime 状态。
- 未连接本地 Desktop 时仍可创建 `local_desktop` 工作区，导致创建后不可用。
- 附件按钮可见但无行为。
- Desktop 报错：`No handler registered for 'device-channel:connect'`。
- 用户需要知道 Electron 如何连接 Codex / Claude Code。

本任务目标是把这些问题收敛为可验证的用户链路：用户能在 Web workspace 中理解当前身份和本地连接状态，能管理 Role Agents，能被正确阻止创建不可用的本地工作区，能看到明确的附件能力状态；Desktop 能注册并响应 device channel IPC，并清楚表达本地 Claude/Codex CLI 连接方式。

---

## 3. 用户链路合同

### 3.1 Web Workspace 基础导航与状态

1. 用户登录后进入 `/workspace/:id`。
2. 页面顶部或左侧栏必须提供返回“我的工作区”的入口。
3. 页面必须展示当前登录状态或用户身份摘要。
4. 页面必须展示 Desktop 本地连接状态与本地 Runtime 状态，至少区分：未连接、连接中、已连接、错误/不可用。
5. 状态不可用时必须提供明确中文说明，不允许静默失败或只显示图标。

### 3.2 本地工作区创建门禁

1. 用户打开“新建工作区”。
2. 若选择“本地桌面 / local_desktop”，系统必须检查 Desktop device channel 是否 connected。
3. 未连接时不得静默创建不可用本地工作区；必须禁用提交或在提交前显示明确中文引导。
4. 已连接时允许创建本地工作区，并保持既有 cloud 工作区创建逻辑不回归。

### 3.3 Agents 管理

1. 用户在 Workspace 右栏打开 Agents。
2. 系统必须展示当前 workspace 的真实 role_agents。
3. 用户必须能创建、编辑、删除 Role Agent，并能设定/取消编排者状态。
4. 所有操作必须调用 `/api/role-agents` 或 `/api/role-agents/:id` 并刷新列表。
5. 删除默认架构师等高风险操作必须有确认或明确后果提示。
6. 错误时必须显示具体中文错误，不允许只保留“暂无 Agent”。

### 3.4 编排面板

1. 用户在 Workspace 右栏打开“编排”。
2. 未选择会话时显示空态。
3. 当前会话没有 plans/actions 时显示“暂无计划或动作”空态。
4. `/api/plans` 或 `/api/actions` 失败时显示具体状态码/错误内容。
5. 不允许把接口失败泛化为不可行动的“加载编排数据失败”。

### 3.5 附件按钮

1. 用户看到附件按钮。
2. 若本期不实现上传，按钮必须禁用并给出“附件上传暂未开放”等明确 tooltip/title/aria 说明。
3. 若实现上传，必须接入真实文件选择和后端链路。
4. 不允许出现可点击但无效果的按钮。

### 3.6 Desktop 本地连接与 Claude/Codex 链路

1. Desktop renderer 调用 `window.electronAPI.deviceChannel.connect(...)`。
2. preload 通过 IPC 调 `device-channel:connect`。
3. Electron main 必须注册对应 handler，真实点击不再出现 `No handler registered for 'device-channel:connect'`。
4. `DeviceChannel` 使用 device token 连接 Cloud Gateway WebSocket。
5. Gateway 下发 `runtime_invoke` 请求后，Desktop `RuntimeHost` 调 `StreamAdapter` 在本机 `spawn` `claude` 或 `codex` CLI。
6. stdout/stderr 转成 runtime event 回传给 Web/Mobile。
7. UI 或文档必须向用户解释：AgentHub Desktop 不托管 API Key，依赖本机已安装并已认证的 Claude Code / Codex CLI。

---

## 4. 三端职责边界

| 端 | 职责 | 不做什么 |
| --- | --- | --- |
| Web | Workspace 主操作面；展示登录/本地连接/runtime 状态；工作区创建门禁；Role Agent CRUD；编排空态/错误态；附件能力状态 | 不直连本地端口；不在未连接 Desktop 时创建不可用本地 workspace |
| Desktop | 注册 device channel IPC；连接 Cloud Gateway；检测本地 Claude/Codex；通过 RuntimeHost/StreamAdapter 执行本机 CLI | 不托管 Claude/Codex API Key；不把未注册 IPC 当正常状态 |
| Mobile/PWA | 保持既有聊天/runtime 行为，不作为本任务主要修改面 | 不引入新的 Mobile 行为改动，除非共享 API 类型要求 |

---

## 5. 数据与后端合同

- 数据库要求：复用现有 `workspaces`、`role_agents`、`sessions`、`messages`、runtime/device channel 表；不默认新增表。
- 认证/session 要求：所有 Web API 继续使用 Auth.js session 和 owner 权限校验。
- API 要求：
  - `/api/role-agents` CRUD 必须真实可用。
  - `/api/plans`、`/api/actions` 错误必须在 UI 中显示具体信息。
  - 如需要 Desktop connection 状态 API，应复用既有 device/runtime 状态，不返回假 connected。
- 权限和错误语义：无权限返回 403；缺少资源返回 404；前端必须展示中文可行动错误。
- 产品运行时是否允许 mock 主链路数据：否。

---

## 6. UI/UX 合同

- Workspace 内必须提供“我的工作区”返回入口。
- Workspace 内必须展示登录状态、本地连接状态、本地 Runtime 状态。
- 本地工作区创建门禁必须在用户选择执行域时可见。
- Agents 管理必须在当前 workspace 右栏路径内完成，不依赖未渲染的遗留 DetailPanel。
- 附件按钮若未实现必须诚实禁用，不得可点无效果。
- 编排面板必须区分空态与接口错误。
- 所有新增用户文案使用简体中文。
- 桌面/移动布局不得新增横向滚动、遮挡、不可点击浮层。

---

## 7. 参考项目输入

| 参考项目 | 读取范围 | 提炼内容 | 不采用内容 |
| --- | --- | --- | --- |
| `refer_proj/cherry-studio` | 本地模型/设置/状态提示/侧栏入口 | 本地 runtime 状态、设置入口、不可用能力提示方式 | 不复制代码，不提交 refer_proj |
| `refer_proj/sxhxliang__agent-studio` | Agent 管理与工作台布局（如可读） | Agent 列表/配置入口的交互模式 | 不复制代码，不提交 refer_proj |
| 既有 `research/reference-repos/` | 已提炼的产品结构规则 | 工作区、Agent、状态提示规则 | 不把参考项目皮肤当目标 |

---

## 8. Trellis 派生要求

- `.trellis/tasks/05-31-workspace-local-desktop-uat/prd.md` 必须引用本合同。
- 实现前必须读取 frontend/backend/cross-layer 相关 spec。
- Codex inline 模式下跳过 jsonl 注入，但任务 PRD 仍需记录相关 spec 和研究结论。
- 如本任务沉淀出“可见按钮必须有真实行为或显式禁用”的规则，应更新 `.trellis/spec/frontend/quality-guidelines.md` 或相关指南。

---

## 9. Maestro/Ralph 派生要求

本任务明确不使用 Maestro/Ralph。

---

## 10. 测试与验收合同

自动化测试必须覆盖：

- type-check：`pnpm --filter @agenthub/web type-check`，Desktop 改动时运行 `pnpm --filter @agenthub/desktop type-check`。
- Web E2E：真实浏览器验证 workspace 返回入口、状态栏、local_desktop 门禁、Agents CRUD、编排空态/错误态、附件禁用/行为。
- Desktop 测试：验证 `device-channel:connect` IPC handler 注册并可被 preload 调用；RuntimeHost/StreamAdapter 链路至少通过单元或集成测试覆盖。
- 视觉/布局断言：新增 UI 不引起横向滚动、遮挡、按钮不可点击。
- 数据库验证：Agents CRUD 使用真实 API/DB，不用 `page.route` mock 主链路。

人工验收路径：

1. 启动 Web 3000 与 Desktop dev。
2. Web 登录后进入 `/workspace/:id`。
3. 查看登录状态、本地连接状态、本地 Runtime 状态。
4. 未连接 Desktop 时尝试创建本地工作区，应被明确阻止或提示。
5. 连接 Desktop 后创建本地工作区。
6. 在 Agents 面板创建/编辑/删除角色并验证 @角色列表同步。
7. 打开编排面板，空态和接口错误可区分。
8. 点击附件按钮，看到明确禁用/暂未开放说明或真实上传行为。
9. Desktop 不再报 `No handler registered for 'device-channel:connect'`。

---

## 11. 计划阶段禁止项

- 不得只修文案而不修真实点击结果。
- 不得把按钮可见、接口 200 或本地 state 更新当完成。
- 不得使用 mock role_agents/plans/actions 证明主链路。
- 不得绕过 Desktop IPC 注册问题，只在 renderer catch 中吞错。
- 不得提交任务前已有的无关 E2E dirty 文件。

---

## 12. 验真样本

| 样本 | 合同描述 | 不应预置的答案 | 通过标准 |
| --- | --- | --- | --- |
| 编排失败 | 当前会话编排面板必须区分空态和 API 错误 | 不预置是 plans 还是 actions 失败 | 测试能模拟/复现失败并显示具体错误 |
| Agents 不可管理 | Workspace 内必须能 CRUD 真实 role_agents | 不预置遗留 DetailPanel 路径 | 用户能从当前右栏完成 CRUD |
| 本地连接门禁 | 未连接 Desktop 时 local_desktop 创建不可静默成功 | 不预置具体状态来源 | 未连接时阻止或明确提示，已连接时允许 |
| Desktop IPC | `device-channel:connect` 必须有 main handler | 不预置构建版本或初始化顺序 | Electron API 调用不再报 no handler |

---

## 13. 完成门禁

- [ ] `research/project-tracker.md` 已更新。
- [ ] 新增或更新 `research/regression-ledger.md`，登记并关闭本任务相关缺口。
- [ ] 阶段级执行说明或任务 PRD 包含真实验证命令与结果。
- [ ] 精确 commit，禁止 `git add .`。
- [ ] 不提交 `refer_proj/*`、缓存、临时日志、`.workflow/.maestro/*/status.json`。
- [ ] 不提交任务前已有的 5 个 E2E dirty 文件，除非用户明确确认它们属于本任务。
- [ ] `bash scripts/verify-governance-gate.sh WORKSPACE-LOCAL-DESKTOP-UAT-001` exit 0，或如 Trellis 任务类型导致 false positive，必须解释并补齐 tracker/ledger/report。
- [ ] Codex 按本合同完成独立验收。

---

## 14. 残留风险与后续

- 真实 Electron GUI E2E 可能依赖本地构建环境；若不可运行，必须用 main/preload/renderer 测试覆盖并登记 GUI 验证 deferred。
- 附件上传若超出本任务，应明确禁用并登记后续任务，不允许可点无效果。
- 默认开发环境 `.env.local` 占位符问题已在 REG-20260530-008 中登记，若阻碍本任务验证需单独说明。
