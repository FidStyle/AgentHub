# AgentHub 产品设计文档

**作者：** joytion, Codex  
**日期：** 2026-05-21  
**状态：** Draft  
**版本：** 0.1  
**上游 PRD：** `research/prd.md`  
**原始素材：** `bytedance_init_prd.md`, `bytedance_init_video_txt.txt`

---

## 1. 设计目标

AgentHub 的产品体验必须围绕「像 IM 一样与 Role Agent 协作」展开。Web 承担完整工作台，Desktop 承担本地 Connector，Mobile 承担轻量 IM、审批和预览。三端共享账号、Workspace、Session、Role Agent、权限和消息数据，但不复制彼此的全部功能。

本设计文档只定义产品信息架构、页面逻辑、核心用户流、组件状态和交互边界。技术框架、Runtime 接入方式、云端转发协议和持久化方案在 `research/technical-design.md` 中确定。

对应需求：`FR-AUTH-001`, `FR-WS-001`, `FR-DEVICE-001`, `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001`, `FR-CHAT-001`。

---

## 2. 产品设计原则

### 2.1 IM 是主心智

用户进入产品后首先看到的是 Workspace 内的 Session 列表和消息流，而不是 IDE、模型控制台或部署平台。所有任务发起、上下文传递、Agent 协作、结果确认都应回到聊天流。

对应需求：`FR-CHAT-001`, `FR-WEB-001`, `NFR-UX-001`。

### 2.2 用户面对 Role Agent，不面对工具名

聊天对象必须是 Orchestrator、前端工程师、测试、代码审查、PM 等 Role Agent。Claude Code、Codex 只在 Role Agent 配置、Desktop Runtime 检测和诊断中出现。

对应需求：`FR-AGENT-001`, `FR-RUNTIME-001`。

### 2.3 Workspace 执行域不可混用

每个 Workspace 创建时必须确定执行域：`Cloud Workspace` 或 `Local Desktop Workspace`。同一个 Workspace 内的 Session、Role Agent Runtime、Action 执行位置必须继承该执行域。产品层不允许在一个 Workspace 中把云端 Runtime 和本地 Claude Code/Codex 混用。

对应需求：`FR-WS-001`, `FR-RUNTIME-001`, `NFR-SEC-001`。

### 2.4 确认绑定到任务和权限，不绑定到 Diff

Diff 是展示材料，不是独立审批类型。需要确认的是 Orchestrator 计划、任务下一步、权限升级、部署或发布、失败重试。

对应需求：`FR-PERM-001`, `FR-NOTIFY-001`, `FR-RESULT-001`。

### 2.5 三端按场景分工

Web 提供完整信息密度；Desktop 显示本地连接和执行状态；Mobile 只保留轻量消息、审批、进度和产物预览。Mobile 不提供本地 Runtime 接入，也不做复杂代码编辑。

对应需求：`FR-DEVICE-001`, `FR-MOB-001`, `NFR-UX-002`。

---

## 3. 信息架构

### 3.1 全局对象层级

```text
User
└── Workspace
    ├── Workspace Settings
    ├── Role Agents
    └── Session
        ├── Messages
        ├── Participants
        ├── Pinned Context
        ├── Orchestrator Plan
        ├── Actions
        ├── Task Result Cards
        └── Artifacts
```

对应需求：`FR-AUTH-001`, `FR-WS-001`, `FR-CHAT-001`, `FR-CTX-001`, `FR-RESULT-001`。

### 3.2 Workspace 类型

| 类型 | 用户心智 | 绑定对象 | 执行位置 | 三端行为 |
| --- | --- | --- | --- | --- |
| Cloud Workspace | 使用平台云端工作区 | 云端项目目录或个人云工作区 | 云端 Runtime | Web/Mobile 作为控制端发起消息、审批和 Action；执行落在云端 Runtime；Desktop 可查看但不是必需 Connector |
| Local Desktop Workspace | 使用自己的电脑项目 | Desktop Connector 授权的本地文件夹 | 在线 Desktop Connector 暴露的本地 Runtime | Web/Mobile 作为控制端发起消息、审批和 Action；执行经云端后端下发到 Desktop Connector；Desktop 离线时不可执行 |

对应需求：`FR-WS-001`, `FR-DESK-001`, `FR-RUNTIME-001`。

### 3.3 Session 类型

| 类型 | 入口 | 默认路由 | 适用场景 | P0 状态 |
| --- | --- | --- | --- | --- |
| 单 Role Session | 新建会话时选择一个 Role Agent，或消息中只 @ 一个 Role Agent | Direct Role Flow | 明确知道要找哪个角色处理 | 必做 |
| 多 Role Session | 新建会话时选择多个 Role Agent，或消息中 @ 多个 Role Agent | Orchestrated Flow | 需要多角色分工 | 必做 |
| Orchestrator Session | 未 @ 角色，或显式 @ Orchestrator | Orchestrated Flow | 需求不清、任务复杂、需要计划 | 必做 |

对应需求：`FR-CHAT-001`, `FR-ORCH-001`。

---

## 4. Web 产品设计

### 4.1 Web 页面地图

| 页面 | P0/P1 | 说明 | 绑定需求 |
| --- | --- | --- | --- |
| 登录页 | P0 | GitHub OAuth 登录入口 | `FR-AUTH-001` |
| Workspace 选择页 | P0 | 查看 Workspace，创建 Cloud 或 Local Desktop Workspace | `FR-WS-001` |
| Workspace 创建向导 | P0 | 输入名称、选择执行域、绑定云端目录或等待 Desktop 选择本地目录 | `FR-WS-001`, `FR-DESK-001` |
| 三栏 IM 工作台 | P0 | 左栏 Workspace/Session，中栏消息，右栏产物和上下文 | `FR-WEB-001`, `FR-CHAT-001` |
| Role Agent 管理页/面板 | P0 | 模板创建、编辑名称、能力、System Prompt、Runtime 绑定 | `FR-AGENT-001`, `FR-RUNTIME-001` |
| Pending Approvals 队列 | P0 | 展示当前用户待确认事项 | `FR-NOTIFY-001`, `FR-PERM-001` |
| Workspace 设置页 | P0 | 查看执行域、权限策略、Desktop 连接状态 | `FR-WS-001`, `FR-PERM-001` |
| Session 搜索/归档 | P1 | 搜索、置顶、归档 | `FR-IM-101` |
| 工具集配置 | P1 | 配置 Role Agent 可用 Action | `FR-AGENT-101` |

### 4.2 Web 三栏布局

#### 左栏：Workspace 与 Session

左栏用于定位当前项目和任务会话。

必须包含：

- Workspace 切换器，展示名称、执行域标识和连接状态。
- 新建 Session 按钮。
- Session 列表，按最近活跃排序。
- 每条 Session 展示标题、最近消息摘要、参与 Role Agent、状态徽标。
- Pending Approval 入口，展示待处理数量。

状态：

- `empty`: 当前 Workspace 无 Session，展示新建会话入口。
- `desktop-offline`: Local Desktop Workspace 的 Connector 离线，Session 可查看但执行入口置灰。
- `requires-approval`: 某 Session 有待确认项，列表项展示提示。
- `failed`: 最近任务失败，列表项展示失败状态。

对应需求：`FR-WEB-001`, `FR-CHAT-001`, `FR-NOTIFY-001`, `FR-DESK-001`。

#### 中栏：消息流与任务控制

中栏是主工作区。用户通过消息输入框发起任务、@ Role Agent、确认计划、查看流式回复和结果卡片。

必须支持的消息和卡片：

- 用户文本消息。
- Role Agent 流式消息。
- Orchestrator 澄清问题。
- Orchestrator 计划卡。
- 权限确认卡。
- Action 状态卡。
- Task Result Card。
- Markdown 消息。
- 代码块，含语法高亮和复制按钮。
- Diff 卡片。
- 图片、文件引用、网页预览卡。

对应需求：`FR-WEB-001`, `FR-CHAT-001`, `FR-ARTIFACT-001`, `FR-RESULT-001`, `FR-ORCH-001`, `FR-PERM-001`。

#### 右栏：Artifacts / Context / Agents / Preview

右栏承载聊天流中被选中的对象，不能抢占聊天主心智。

| Tab | P0 内容 | 绑定需求 |
| --- | --- | --- |
| Artifacts | 文件引用、Diff、图片、代码块、结果卡片详情 | `FR-ARTIFACT-001`, `FR-RESULT-001` |
| Context | 已 pin 消息、handoff 上下文包、相关文件 | `FR-CTX-001` |
| Agents | 当前 Session 参与 Role Agent、能力标签、Runtime 绑定摘要 | `FR-AGENT-001`, `FR-RUNTIME-001` |
| Preview | 网页预览、dev server URL、轻量产物预览 | `FR-ARTIFACT-001`, `FR-ACTION-001` |

状态：

- `no-selection`: 未选择产物时展示当前 Session 概览。
- `loading-preview`: 预览加载中。
- `preview-unavailable`: 无预览或 Action 未启动。
- `permission-required`: 需要批准 Action 才能生成预览。
- `desktop-offline`: 本地预览依赖 Desktop Connector，但 Connector 不在线。

对应需求：`FR-WEB-001`, `FR-CTX-001`, `FR-ACTION-001`。

---

## 5. Desktop 产品设计

### 5.1 Desktop 定位

Desktop 是 Connector Console，不是完整 Web 工作台。它的核心任务是证明用户自己的本地开发环境可以被 AgentHub 安全、可见、可控地接入。

对应需求：`FR-DESK-001`, `FR-RUNTIME-001`, `NFR-SEC-001`。

### 5.2 Desktop 页面地图

| 页面 | P0/P1 | 说明 | 绑定需求 |
| --- | --- | --- | --- |
| 登录/设备绑定 | P0 | 使用 GitHub OAuth 或设备码绑定同一用户身份 | `FR-AUTH-001` |
| Connector 首页 | P0 | 展示在线状态、当前账号、云端可达性 | `FR-DESK-001` |
| 本地 Workspace 绑定 | P0 | 选择本地文件夹，设置 Workspace 名称和文件夹名 | `FR-WS-001`, `FR-DESK-001` |
| Runtime 检测 | P0 | 检测 Claude Code、Codex 可用性和登录状态 | `FR-RUNTIME-001` |
| 执行请求列表 | P0 | 展示最近 Runtime/Action 请求、状态、失败原因 | `FR-DESK-001`, `FR-ACTION-001` |
| 待审批队列 | P0 | 展示计划确认、权限升级、重试确认 | `FR-NOTIFY-001`, `FR-PERM-001` |
| 打开 Web | P0 | 跳转当前 Workspace 的 Web 工作台 | `FR-DESK-001` |
| 系统通知设置 | P1 | 配置 Desktop OS 通知 | `FR-NOTIFY-101` |

### 5.3 Desktop 关键状态

| 状态 | 用户可见文案方向 | 允许操作 | 禁止操作 |
| --- | --- | --- | --- |
| `not-signed-in` | 需要登录或绑定账号 | 登录 | 绑定 Workspace、执行任务 |
| `online` | Connector 在线 | 接收请求、执行已批准动作 | 无 |
| `offline` | Connector 未连接云端 | 查看本地历史、重新连接 | 接收 Web/Mobile 远程请求 |
| `runtime-missing` | 未检测到 Claude Code 或 Codex | 查看安装说明、重新检测 | 绑定对应 Runtime |
| `runtime-auth-required` | Runtime 未登录或不可调用 | 打开 Runtime 登录说明、重新检测 | 执行对应 Role Agent 任务 |
| `workspace-not-bound` | 尚未选择本地文件夹 | 选择文件夹 | 执行本地 Action |
| `permission-required` | 有请求等待确认 | 批准或拒绝 | 自动执行该请求 |
| `running` | 正在执行 Runtime 或 Action | 查看状态、取消支持时取消 | 重复执行同一请求 |
| `failed` | 执行失败 | 查看原因、重试或回到 Web | 隐藏失败原因 |

对应需求：`FR-DESK-001`, `FR-RUNTIME-001`, `FR-ACTION-001`, `FR-PERM-001`。

---

## 6. Mobile 产品设计

### 6.1 Mobile 定位

Mobile 是远程轻量控制端。它让用户在离开电脑时查看 Agent 进度、回复澄清问题、审批计划或权限动作、打开预览链接。它不承担 Runtime Connector、完整代码编辑和复杂 Diff 合并。

对应需求：`FR-MOB-001`, `FR-NOTIFY-001`, `NFR-UX-002`。

### 6.2 Mobile 页面地图

| 页面 | P0/P1 | 说明 | 绑定需求 |
| --- | --- | --- | --- |
| 登录页 | P0 | GitHub OAuth 登录 | `FR-AUTH-001` |
| Workspace 列表 | P0 | 查看 Workspace、执行域和连接状态 | `FR-WS-001`, `FR-DEVICE-001` |
| Session 列表 | P0 | 查看最近会话、待确认提示 | `FR-CHAT-001`, `FR-NOTIFY-001` |
| 轻量 Session 页 | P0 | 消息流、文本回复、@ Role Agent、结果卡片摘要 | `FR-MOB-001`, `FR-CHAT-001` |
| 审批详情页 | P0 | 批准/拒绝计划、权限升级、重试 | `FR-PERM-001`, `FR-NOTIFY-001` |
| 预览页 | P0 | 打开 preview URL、查看图片和摘要 | `FR-ARTIFACT-001`, `FR-RESULT-001` |
| Push 设置页 | P1 | 移动推送设置 | `FR-NOTIFY-101` |

### 6.3 Mobile 简化规则

Mobile 必须隐藏或降级以下复杂操作：

- 不展示完整代码编辑器。
- Diff 只提供摘要和只读展开，不提供复杂合并。
- 不提供本地 Claude Code/Codex Runtime 绑定。
- 不允许选择本地文件夹。
- 对 Local Desktop Workspace，所有执行都必须提示「需要 Desktop Connector 在线」。
- 大型执行输出默认折叠，只展示状态、摘要和关键错误。

对应需求：`FR-MOB-001`, `FR-ARTIFACT-001`, `FR-RESULT-001`, `FR-DESK-001`。

---

## 7. 核心用户流

### 7.1 登录与身份恢复

1. 用户在 Web、Desktop 或 Mobile 点击 GitHub 登录。
2. GitHub OAuth 成功后，系统创建或恢复 AgentHub User。
3. 用户进入 Workspace 列表。
4. 如果没有 Workspace，进入 Workspace 创建向导。

异常状态：

- OAuth 失败：展示重试入口。
- 用户主动退出：当前设备清除受保护数据访问。
- 多端登录：同一个 GitHub 用户恢复同一 Workspace 与 Session 数据。

对应需求：`FR-AUTH-001`。

### 7.2 创建 Cloud Workspace

1. 用户在 Web 选择「新建 Workspace」。
2. 输入 Workspace 名称和云端文件夹名。
3. 选择执行域 `Cloud`。
4. 系统创建云端项目目录。
5. 用户进入 Web 三栏工作台。
6. Role Agent 只能绑定云端 Runtime。

禁止行为：

- Cloud Workspace 不显示「绑定本地 Claude Code/Codex」作为可选 Runtime。
- Cloud Workspace 的执行只落在云端项目目录，不能影响用户本地文件。

对应需求：`FR-WS-001`, `FR-RUNTIME-001`。

### 7.3 创建 Local Desktop Workspace

1. 用户在 Web 或 Desktop 选择「新建 Local Desktop Workspace」。
2. 用户输入 Workspace 名称。
3. Desktop Connector 引导用户选择本地文件夹，或按用户输入的文件夹名创建文件夹。
4. Desktop 记录授权目录并展示在线状态。
5. Web/Mobile 中该 Workspace 展示 `Local Desktop` 执行域和 Desktop 连接状态。
6. Role Agent 只能绑定 Desktop Connector 暴露的本地 Claude Code 或 Codex Runtime。

异常状态：

- Desktop 未登录：提示先绑定同一 GitHub 账号。
- Desktop 离线：Workspace 可查看，执行入口置灰。
- 文件夹权限不足：Desktop 显示失败原因，Web/Mobile 展示不可执行。
- 未检测到 Runtime：Role Agent Runtime 绑定不可完成。

对应需求：`FR-WS-001`, `FR-DESK-001`, `FR-RUNTIME-001`, `NFR-SEC-001`。

### 7.4 新建 Session

1. 用户在 Web 点击新建 Session。
2. 系统要求选择 Workspace。
3. 用户可选择参与 Role Agent，也可不选。
4. 用户输入首条消息。
5. 系统根据 @ 规则决定路由。

路由规则：

- 未 @ Role Agent：进入 Orchestrated Flow。
- @ Orchestrator：进入 Orchestrated Flow。
- @ 单个非 Orchestrator Role Agent：进入 Direct Role Flow。
- @ 多个 Role Agent：进入 Orchestrated Flow。

对应需求：`FR-CHAT-001`, `FR-ORCH-001`。

### 7.5 Direct Role Flow

1. 用户 @ 单个 Role Agent 并发送任务。
2. 系统检查该 Role Agent 是否属于当前 Workspace，且 Runtime 与 Workspace 执行域一致。
3. Role Agent 直接回复，必要时通过 Adapter 调用 Runtime。
4. Role Agent 可以产出消息、Action 状态卡或 Task Result Card。
5. 如果任务超出单角色能力，Role Agent 提示升级为 Orchestrated Flow。
6. 用户确认升级后，由 Orchestrator 接管并生成计划。

异常状态：

- Role Agent 未绑定 Runtime：提示去配置或换角色。
- Runtime 与 Workspace 执行域不一致：阻止执行并展示原因。
- 本地 Connector 离线：Local Desktop Workspace 的执行请求进入不可执行状态。
- 权限不足：展示权限确认卡。

对应需求：`FR-CHAT-001`, `FR-AGENT-001`, `FR-RUNTIME-001`, `FR-ORCH-001`, `FR-PERM-001`。

### 7.6 Orchestrated Flow

1. Orchestrator 接收用户需求。
2. 如果需求不清，Orchestrator 先提出澄清问题。
3. 信息足够后，Orchestrator 生成计划卡。
4. 计划卡从结构化 Plan DAG 渲染，展示步骤、依赖关系、可并行分组、分派 Role Agent、预期产物、可能触发的权限敏感动作。
5. 默认等待用户确认。
6. 用户可批准计划、要求修改计划、停止，或明确授权本 Session 自动推进。
7. 后端校验 Plan DAG：无环、Role Agent 合法、Runtime 执行域一致、未知依赖不可执行。
8. Orchestrator 为 ready 节点构造 Context Package 并分派给 Role Agent；同一并行组内无冲突节点可以同时执行。
9. Role Agent 执行并回传节点状态。
10. Orchestrator 在节点完成后重新计算 ready、waiting、blocked、failed。
11. Orchestrator 汇总结果并给出下一步建议。

计划卡 P0 展示规则：

- 以列表或分组形式展示 Plan DAG，不做复杂拖拽式 DAG 编辑器。
- 每个节点展示 Role Agent、目标、依赖、状态、预期产物和风险等级。
- 并行节点用同一分组或「可并行」标识展示。
- 节点失败时展示受影响的等待节点，并提供重试、跳过、调整计划、停止。
- 用户要求修改计划时，系统生成新的 plan version，并重新进入确认。

自动推进规则：

- 用户必须显式开启自动推进。
- 自动推进只跳过普通计划确认或低风险下一步确认。
- 高风险动作仍必须确认。

对应需求：`FR-ORCH-001`, `FR-CTX-001`, `FR-PERM-001`, `FR-NOTIFY-001`, `FR-RESULT-001`。

### 7.7 上下文 Pin 与 Handoff

1. 用户在消息、文件引用、Diff 卡片或结果卡片上点击「Pin」。
2. 被 pin 对象进入右栏 Context。
3. 用户选择「交给 Role Agent」。
4. 系统生成 Context Package，包含任务摘要、pin 消息、相关文件、前序结论和目标。
5. 如果目标 Role Agent 绑定 Claude Code/Codex，Adapter 在能力允许时继续对应 native session。

对应需求：`FR-CTX-001`, `FR-RUNTIME-001`, `FR-ARTIFACT-001`。

### 7.8 Action 与预览

1. Role Agent 或 Orchestrator 发起 Action 请求。
2. 系统根据 Workspace/Session 策略判断是否需要确认。
3. 需要确认时，在聊天中生成权限确认卡，并进入 Pending Approvals 队列。
4. 用户批准后执行：
   - Cloud Workspace：云端 Runtime 执行。
   - Local Desktop Workspace：Desktop Connector 执行。
5. Action 状态卡展示 pending、running、succeeded、failed、canceled。
6. 成功后结果卡片可展示 preview URL 或执行输出摘要。

对应需求：`FR-ACTION-001`, `FR-PERM-001`, `FR-NOTIFY-001`, `FR-RESULT-001`。

### 7.9 Mobile 审批与回复

1. 用户在 Mobile 收到站内待审批提示，或打开 Pending Approvals。
2. 审批详情页展示来源 Workspace、Session、触发消息、请求方、风险说明和可选动作。
3. 用户批准、拒绝或要求修改。
4. 系统把决定同步回对应 Session。
5. 用户也可在轻量 Session 页直接回复 Orchestrator 澄清问题或 @ Role Agent。

对应需求：`FR-MOB-001`, `FR-NOTIFY-001`, `FR-PERM-001`。

---

## 8. 关键组件设计

### 8.1 Chat Composer

能力：

- 输入文本。
- 基础 Markdown 输入。
- @ Role Agent。
- 展示当前路由预判：`将发送给 Orchestrator`、`将发送给前端工程师` 等。
- 发送前检查当前 Workspace 执行状态。

状态：

- `ready`: 可发送。
- `empty`: 无内容时发送按钮禁用。
- `desktop-offline`: Local Desktop Workspace 中提示只能发送消息，不能执行本地任务。
- `runtime-unavailable`: 已 @ 的 Role Agent 无可用 Runtime。
- `sending`: 正在提交。

对应需求：`FR-CHAT-001`, `FR-AGENT-001`, `FR-RUNTIME-001`, `FR-DESK-001`。

### 8.2 Role Mention Picker

能力：

- 搜索 Role Agent。
- 展示头像、名称、能力标签、Runtime 状态。
- 隐藏或禁用与 Workspace 执行域不匹配的 Role Agent。
- 支持选择一个或多个 Role Agent。

对应需求：`FR-CHAT-001`, `FR-AGENT-001`, `FR-RUNTIME-001`。

### 8.3 Orchestrator Plan Card

字段：

- 计划标题。
- 任务理解摘要。
- 步骤列表，由 Plan DAG 节点渲染。
- 依赖关系和可并行分组。
- 每步分派 Role Agent。
- 预期产物。
- 可能触发的权限敏感动作。
- 节点状态：pending、ready、running、blocked、completed、failed。
- 阻塞原因：等待依赖、Connector 离线、权限待确认、Runtime 不可用、计划校验失败。
- 执行模式：确认后执行 / 本 Session 自动推进。

操作：

- 批准计划。
- 要求修改。
- 停止。
- 授权本 Session 自动推进。
- 节点失败后选择重试、跳过、调整计划或停止。

状态：

- `drafting`
- `requires-confirmation`
- `approved`
- `rejected`
- `running`
- `blocked`
- `completed`
- `failed`

对应需求：`FR-ORCH-001`, `FR-CTX-001`, `FR-PERM-001`, `FR-NOTIFY-001`, `FR-RESULT-001`。

### 8.4 Permission Confirmation Card

字段：

- 请求方 Role Agent 或 Orchestrator。
- Action 类型。
- Workspace 与 Session。
- 执行位置：Cloud 或 Local Desktop。
- 风险等级。
- 请求原因。
- 影响范围，例如工作目录、命令摘要、受限路径。

操作：

- 批准一次。
- 拒绝。
- 查看详情。

P0 不提供：

- 永久信任某命令。
- 复杂策略编辑器。
- 多人审批。

对应需求：`FR-PERM-001`, `FR-ACTION-001`, `FR-NOTIFY-001`。

### 8.5 Task Result Card

字段：

- 任务状态。
- 执行 Role Agent。
- 结果摘要。
- 文件变更列表。
- Git diff 展开入口。
- Preview URL。
- 执行输出摘要，仅在 Runtime 或 Action 运行命令、测试、构建、预览或部署时出现。

操作：

- 展开详情。
- 打开 Preview。
- 复制摘要。
- 交给某个 Role Agent 继续处理。
- 失败时重试或交给 Orchestrator 调整计划。

状态：

- `running`
- `succeeded`
- `failed`
- `canceled`
- `requires-next-step-confirmation`

对应需求：`FR-RESULT-001`, `FR-ARTIFACT-001`, `FR-CTX-001`。

### 8.6 Artifact Card

类型：

- Markdown 消息。
- 代码块。
- 图片。
- 文件引用。
- 网页预览。
- Diff。
- Action 状态。

统一操作：

- 展开。
- 复制。
- Pin。
- Handoff 给 Role Agent。

代码块要求：

- 语法高亮。
- 一键复制。
- 复制成功反馈。

Diff 要求：

- 作为展示材料出现。
- 支持展开查看。
- 不单独触发审批。

对应需求：`FR-ARTIFACT-001`, `FR-PERM-001`。

### 8.7 Pending Approval Queue

能力：

- 跨 Workspace 展示待审批项。
- 按时间倒序。
- 标记来源 Workspace、Session、消息、任务或 Action。
- 支持跳转到原 Session。
- 支持批准或拒绝。

审批类型：

- Orchestrator 计划确认。
- 任务结果下一步确认。
- 权限升级确认。
- 部署或发布确认。
- 失败任务重试确认。

对应需求：`FR-NOTIFY-001`, `FR-PERM-001`。

### 8.8 Desktop Connector Status

字段：

- 当前账号。
- 在线状态。
- 云端连接状态。
- 当前绑定本地 Workspace。
- Claude Code 检测状态。
- Codex 检测状态。
- 最近执行请求。

对应需求：`FR-DESK-001`, `FR-RUNTIME-001`, `FR-ACTION-001`。

---

## 9. 空状态、加载态、错误态

| 场景 | 状态设计 | 绑定需求 |
| --- | --- | --- |
| 无 Workspace | 引导创建 Cloud 或 Local Desktop Workspace | `FR-WS-001` |
| 无 Session | 引导新建 Session，并提示可 @ Role Agent | `FR-CHAT-001` |
| 无 Role Agent | 展示内置模板创建入口 | `FR-AGENT-001` |
| Desktop 离线 | 展示最后在线时间和重新连接指引 | `FR-DESK-001` |
| Runtime 不可用 | 展示检测失败原因和重新检测入口 | `FR-RUNTIME-001` |
| 消息发送失败 | 展示重试和复制消息入口 | `FR-CHAT-001` |
| Action 执行失败 | 展示失败原因、执行位置、重试入口 | `FR-ACTION-001`, `FR-RESULT-001` |
| 预览不可用 | 展示原因：未启动、失败、无权限、Connector 离线 | `FR-ARTIFACT-001`, `FR-ACTION-001` |
| 权限不足 | 展示确认卡或策略限制说明 | `FR-PERM-001` |

---

## 10. P0 Demo 主路径

1. 用户使用 GitHub OAuth 登录 Web。
2. 用户创建 Local Desktop Workspace。
3. 用户打开 Desktop Connector，绑定同一 GitHub 账号。
4. Desktop 选择本地文件夹，并检测 Claude Code 和 Codex。
5. 用户在 Web 创建 Session。
6. 用户未 @ 角色，发送一个开发任务。
7. Orchestrator 追问或生成计划。
8. 用户批准计划。
9. Orchestrator 分派给某个 Role Agent。
10. Role Agent 通过本地 Claude Code 或 Codex Runtime 执行。
11. Web 中展示流式状态、Action 状态、结果卡片、文件变更、Git diff 和预览链接。
12. 用户在 Mobile 打开同一 Session，查看结果并完成一个待确认动作。
13. 用户继续在 Web 要求某个 Role Agent 修改或让 Orchestrator 继续下一步。

对应需求：`FR-AUTH-001`, `FR-WS-001`, `FR-DESK-001`, `FR-WEB-001`, `FR-MOB-001`, `FR-CHAT-001`, `FR-ORCH-001`, `FR-RUNTIME-001`, `FR-ACTION-001`, `FR-RESULT-001`, `FR-NOTIFY-001`。

---

## 11. P0 / P1 / P2 交互边界

### 11.1 P0 必做

- GitHub OAuth。
- Cloud Workspace 与 Local Desktop Workspace 的执行域表达。
- Web 三栏 IM 工作台。
- Desktop Connector Console。
- Mobile 轻量 IM、审批和预览。
- Direct Role Flow 与 Orchestrated Flow。
- Orchestrator 计划卡和默认确认。
- Role Agent 模板与配置。
- Claude Code、Codex 的本地 Runtime 展示和绑定入口。
- Markdown 渲染、代码块高亮和复制。
- 图片、文件引用、网页预览、Diff、Action 状态、结果卡片。
- Pending Approval 队列。

### 11.2 P1 可增强

- Session 搜索、置顶、归档。
- 消息引用和回复。
- Role Agent 工具集配置。
- 从一句需求创建新项目。
- Desktop 系统通知和 Mobile Push。
- Web 基础代码查看增强。

### 11.3 P2/P3 预留

- 多真人协作。
- Agent Marketplace。
- OpenCode Runtime。
- 非 Git checkpoint、snapshot、回滚。
- 富文档/PPT 编辑。
- 飞书、微信、小程序发布。
- 完整部署平台。
- 复杂 Mobile 代码编辑。

对应需求：`FR-IM-101`, `FR-AGENT-101`, `FR-WORKSPACE-101`, `FR-NOTIFY-101`, `FR-COLLAB-201`, `FR-MARKET-201`, `FR-RUNTIME-201`, `FR-VERSION-201`, `FR-DOCS-201`, `FR-PUBLISH-201`。

---

## 12. 进入技术设计前的问题

以下问题不阻塞产品设计，但必须在 Phase 2 技术设计中收敛：

1. Desktop Connector 使用 Electron 还是 Tauri？
2. Mobile P0 是响应式 Web/PWA，还是独立移动壳？
3. Claude Code 与 Codex 的 native session identity、resume/continue 能力如何验证？
4. Cloud Workspace 的 P0 存储和 Runtime 是否只做最小 Demo 能力？
5. Action/CLI Adapter 的请求结构、权限等级和执行回传事件如何定义？
6. Pending Approval 是轮询、WebSocket 还是事件流？
7. Web、Desktop、Mobile 是否共享同一前端组件包，哪些组件必须分端实现？

对应需求：`FR-DEVICE-001`, `FR-RUNTIME-001`, `FR-ACTION-001`, `FR-NOTIFY-001`。
