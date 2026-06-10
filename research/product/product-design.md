# AgentHub 产品设计文档

**作者：** joytion, Codex
**日期：** 2026-05-21
**状态：** Draft
**版本：** 0.2
**最高事实源：** `bytedance_init_prd.md`
**补充说明源：** `bytedance_init_video_txt.txt`
**上游 PRD：** `research/prd.md`

---

## 0. 设计事实源

本设计文档是 Bytedance 原始课题材料的产品化展开，不是独立产品范围裁剪。事实源优先级为：

1. `bytedance_init_prd.md`
2. `bytedance_init_video_txt.txt`
3. 用户最新确认口径
4. `research/prd.md`
5. 本文档与 UI/技术设计

当本文档与 Bytedance 原始材料冲突时，必须先修本文档和 `research/prd.md`，再继续实现。不能用“当前 PRD 未列入”来否定 Bytedance 原始要求。

## 1. 设计目标

AgentHub 的产品体验必须围绕「像 IM 一样与 Role Agent 协作」展开。

Web 承担完整工作台，Desktop 承担本地 Host/Connector 和策略控制台，Mobile 承担轻量 IM、远程监督授权和预览。三端共享账号、Workspace、Session、Role Agent、权限和消息数据，但不复制彼此的全部功能。

本设计文档只定义产品信息架构、页面逻辑、核心用户流、组件状态和交互边界。

技术框架、Runtime 接入方式、云端转发协议和持久化方案在 `research/architecture/technical-design.md` 中确定。

对应需求：`FR-AUTH-001`, `FR-WS-001`, `FR-DEVICE-001`, `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001`, `FR-CHAT-001`。

---

## 2. 产品设计原则

### 2.1 IM 是主要入口

用户进入产品后首先看到的是 Workspace 内的 Session 列表和消息流，而不是 IDE、模型控制台或部署平台。

所有任务发起、上下文传递、Agent 协作、结果确认都应回到聊天流。

对应需求：`FR-CHAT-001`, `FR-WEB-001`, `NFR-UX-001`。

### 2.2 用户面对 Role Agent，不面对工具名

聊天对象必须是 Orchestrator、前端工程师、测试、代码审查、PM 等 Role Agent。Claude Code、Codex 只在 Role Agent 配置、Desktop Runtime 检测和诊断中出现。

对应需求：`FR-AGENT-001`, `FR-RUNTIME-001`。

### 2.3 Workspace 执行域不可混用

每个 Workspace 创建时必须确定执行域：`Cloud Workspace` 或 `Local Desktop Workspace`。

同一个 Workspace 内的 Session、Role Agent Runtime、Action 执行位置必须继承该执行域。产品层不允许在一个 Workspace 中把云端 Runtime 和本地 Claude Code/Codex 混用。

对应需求：`FR-WS-001`, `FR-RUNTIME-001`, `NFR-SEC-001`。

### 2.4 授权绑定到任务和权限，不绑定到 Diff

Diff 是展示材料，不是独立授权类型。需要用户确认的是 Orchestrator 计划、任务下一步、权限升级、部署或发布、失败重试。

对应需求：`FR-PERM-001`, `FR-NOTIFY-001`, `FR-RESULT-001`。

### 2.5 产物创建和收口聊天优先

用户不需要在右侧面板手工选择“哪个文件算产物”。产品交付链路应由 Orchestrator 分派执行角色，再由内置 `产物助手` 在聊天流中完成收口：判断产物类型、创建主产物和辅助产物、生成预览/发布卡，并同步右侧 Artifacts 列表。

右侧 Artifacts 是读取、预览、启动、停止、下载和回链产物的工作面，不是绕过聊天和角色链路的新建中心。文档、PPT、网页或服务都应先通过正常对话和角色执行产生，再由产物助手登记。

对应需求：`FR-ARTIFACT-001`, `FR-RESULT-001`, `FR-ORCH-001`, `FR-ACTION-001`。

### 2.6 三端按场景分工

Web 提供完整信息密度；Desktop 提供可持续操作的本地主界面，包含本地连接、Runtime 检测、Agent 配置中心、本地策略、本地 Agent 运行态和轻量会话；Mobile 只保留轻量消息、远程监督授权、进度和产物预览。Desktop 不复制完整 Web 三栏工作台，也不提供二次确认中心。Mobile 不提供本地 Runtime 接入，也不做复杂代码编辑。

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

| 类型 | 用户理解 | 绑定对象 | 执行位置 | 三端行为 |
| --- | --- | --- | --- | --- |
| Cloud Workspace | 使用平台云端工作区 | 云端项目目录或个人云工作区 | 云端 Runtime | Web/Mobile 作为控制端发起消息、授权和 Action；执行落在云端 Runtime；Desktop 可查看但不是必需 Connector |
| Local Desktop Workspace | 使用自己的电脑项目 | Desktop Connector 授权的本地文件夹 | 在线 Desktop Connector 暴露的本地 Runtime | Web/Mobile 作为控制端发起消息、授权和 Action；执行经云端后端下发到 Desktop Connector；Desktop 离线时不可执行 |

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
| 三栏 IM 工作台 | P0 | 左栏 Workspace/Session，中栏消息，右栏 Context/Changes/Artifacts | `FR-WEB-001`, `FR-CHAT-001` |
| Role Agent 管理页/面板 | P0 | 查看和编辑已存在 Role Agent 的名称、能力、System Prompt、Runtime 绑定与诊断状态 | `FR-AGENT-001`, `FR-RUNTIME-001` |
| Agent 创建助手 / 聊天内创建 | P0/P1 | 用户在正常聊天流中说“创建一个文档工程师”时生成草稿卡，确认后保存；可由专门 Agent 创建助手承接 | `FR-AGENT-001`, `FR-CHAT-001` |
| 当前 Session 授权与变更 | P0 | 在会话中展示需要授权动作、运行结果、Git diff 和产物 | `FR-NOTIFY-001`, `FR-PERM-001`, `FR-RESULT-001` |
| Workspace 设置页 | P0 | 查看执行域、权限策略、Desktop 连接状态 | `FR-WS-001`, `FR-PERM-001` |
| Session 搜索/归档 | P1 | 搜索、置顶、归档、恢复、按最近活跃排序 | `FR-IM-101` |
| 工具集配置 | P1 | 配置 Role Agent 可用 Action | `FR-AGENT-101` |

### 4.2 Web 三栏布局

#### 左栏：Workspace 与 Session

左栏用于定位当前项目和任务会话。

必须包含：

- Workspace 切换器，展示名称、执行域标识和连接状态。
- 新建 Session 按钮。
- Session 列表，按最近活跃排序。
- 每条 Session 展示标题、最近消息摘要、参与 Role Agent、状态徽标。
- 当前 Session 授权提示，展示待处理数量并跳转对应消息或运行记录。

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

#### 右栏：Context / Changes / Artifacts

右栏承载聊天流中被选中的对象，不能抢占聊天主入口。

| Tab | P0 内容 | 绑定需求 |
| --- | --- | --- |
| Context | 已 pin 消息、handoff 上下文包、相关文件、当前 Session 参与 Role Agent | `FR-CTX-001`, `FR-AGENT-001`, `FR-RUNTIME-001` |
| Changes | 编排计划、授权动作、运行结果、Git diff、文件变更、测试/构建输出摘要 | `FR-PERM-001`, `FR-RESULT-001`, `FR-ACTION-001` |
| Artifacts | 从 durable Artifact API 读取的主产物、辅助产物、文件引用、图片、代码块、预览链接和发布状态 | `FR-ARTIFACT-001`, `FR-RESULT-001` |

状态：

- `no-selection`: 未选择产物时展示当前 Session 概览。
- `loading-preview`: 预览加载中。
- `preview-unavailable`: 无预览或 Action 未启动。
- `permission-required`: 需要授权 Action 才能生成预览或继续执行。
- `desktop-offline`: 本地预览依赖 Desktop Connector，但 Connector 不在线。

Artifacts Tab 不提供“新建富文档”或“新建演示稿”按钮。创建文档、PPT、网页、服务或混合产物的入口仍然是聊天流和角色链路；右侧只负责展示、预览、启动/停止、下载、定位来源消息和回到上下文。

右侧 Role Agent 面板同理只作为已存在角色的查看、编辑和诊断面。对话式创建 Agent 的主入口必须在聊天流中呈现为草稿卡，或由专门的 Agent 创建助手处理；普通产品交付 prompt 不得因为包含“后端工程师”“文档工程师”等词而被误路由为创建 Agent。

对应需求：`FR-WEB-001`, `FR-CTX-001`, `FR-ACTION-001`。

---

## 5. Desktop 产品设计

### 5.1 Desktop 定位

Desktop 是本机 Host、Connector Console 和本地 Runtime 控制台，不是完整 Web 工作台。它的核心任务是证明用户自己的本地开发环境可以被 AgentHub 安全、可见、可控地接入。

根据原始课题材料，桌面端承担本地文件访问、系统通知和 Agent 进程管理。产品上这意味着 Desktop 不能只是静态检测页：它必须提供本地 Runtime 可用性检测、Workspace 绑定、本机权限策略、执行日志、本机策略审计记录、诊断和本地 Agent 运行态入口。

Desktop 可以承担 Codex / Claude Code 的本地轻量对话能力，但该能力只服务当前 Local Desktop Workspace 的本机执行上下文：查看本地 Runtime 输出、执行活动、失败原因、本机策略审计记录和最近消息，并发送轻量诊断、继续、重试、停止等本地指令。主要多 Agent 协作、完整任务对话、跨 Session 管理、Context/Changes/Artifacts、复杂产物编辑和发布部署仍由 Web 工作台承担。

换句话说：Desktop 负责“本地能不能用、当前本地 Runtime 正在做什么、本机策略是什么、哪些动作由 Web/Mobile 授权后越过策略、能否做轻量本机对话”；Web 负责“主要产品工作台和完整 AgentHub 任务流”，Mobile 负责远程监督控制和授权。

对应需求：`FR-DESK-001`, `FR-RUNTIME-001`, `NFR-SEC-001`。

### 5.2 Desktop 页面地图

| 页面 | P0/P1 | 说明 | 绑定需求 |
| --- | --- | --- | --- |
| 登录/设备绑定 | P0 | 使用 GitHub OAuth 或设备码绑定同一用户身份 | `FR-AUTH-001` |
| Connector 首页 | P0 | 展示在线状态、当前账号、云端可达性 | `FR-DESK-001` |
| 本地 Workspace 绑定 | P0 | 选择本地文件夹，设置 Workspace 名称和文件夹名 | `FR-WS-001`, `FR-DESK-001` |
| Runtime 检测 | P0 | 检测 Claude Code、Codex 可用性和登录状态 | `FR-RUNTIME-001` |
| Agent 配置中心 | P0 | 以 Agent/Runtime 卡片展示 Codex、Claude Code、OpenCode 和其他预留 Runtime；Codex/Claude Code 可用，OpenCode 等待接入 | `FR-DESK-001`, `FR-RUNTIME-001`, `FR-UI-001` |
| 本地 Agent 轻量会话 | P0 | 从检测到的 Codex / Claude Code 进入本地运行态会话，查看运行流、最近消息、失败原因和本机策略审计记录，发送轻量诊断/继续/重试类指令 | `FR-DESK-001`, `FR-CHAT-001`, `FR-RUNTIME-001` |
| 执行请求列表 | P0 | 展示最近 Runtime/Action 请求、状态、失败原因 | `FR-DESK-001`, `FR-ACTION-001` |
| 本机策略与审计 | P0 | 展示本机权限预设、策略镜像、执行前校验结果和真实本机策略审计记录 | `FR-DESK-001`, `FR-PERM-001` |
| 打开 Web | P0 | 跳转当前 Workspace 的 Web 工作台 | `FR-DESK-001` |
| 系统通知设置 | P1 | 配置 Desktop OS 通知 | `FR-NOTIFY-101` |

### 5.2.1 Desktop 主壳布局

Desktop 启动后的默认界面必须是可持续操作的主壳，而不是单页检测面板。

| 区域 | P0 内容 | 参考 |
| --- | --- | --- |
| 左侧导航 | 本地 Workspace、本地 Agent、本机策略、设置、登录/账号入口；最近 Session 只有接入可重建的真实会话恢复链路后才能加入 | AionUi `Sider`、codeg `Sidebar` |
| 中间主区 | 本地 Agent 运行态会话、运行流、最近消息、执行状态、失败原因、轻量输入框 | AionUi `ChatLayout`、codeg `ConversationShell` |
| 右侧面板 | Agent 配置中心、Runtime 状态、能力声明、最近诊断、待接入 Runtime | AionUi `LocalAgents`/`AgentCard` |
| 顶部/底部状态 | Connector 在线状态、设备名、当前 Workspace、最近心跳、打开 Web 工作台入口 | codeg `StatusBar` |

打开 Web 工作台不是装饰按钮，而是 Desktop 到主工作台的明确升级入口。复杂 Artifact、Context、跨 Workspace 管理、完整多 Agent 任务流、代码编辑、预览和部署发布必须跳转 Web 完成。Web 未运行、未登录或 Workspace 不存在时，Desktop 必须展示明确中文错误和下一步。

### 5.3 Desktop 关键状态

| 状态 | 用户可见文案方向 | 允许操作 | 禁止操作 |
| --- | --- | --- | --- |
| `not-signed-in` | 需要登录或绑定账号 | 登录 | 绑定 Workspace、执行任务 |
| `online` | Connector 在线 | 接收请求、执行已授权动作 | 无 |
| `offline` | Connector 未连接云端 | 查看本地历史、重新连接 | 接收 Web/Mobile 远程请求 |
| `runtime-missing` | 未检测到 Claude Code 或 Codex | 查看安装说明、重新检测 | 绑定对应 Runtime |
| `runtime-auth-required` | Runtime 未登录或不可调用 | 打开 Runtime 登录说明、重新检测 | 执行对应 Role Agent 任务 |
| `runtime-ready` | Runtime 可用 | 进入本地 Agent 轻量会话、查看能力声明 | 保存 API Key 或 Base URL |
| `workspace-not-bound` | 尚未选择本地文件夹 | 选择文件夹 | 执行本地 Action |
| `permission-required` | 有请求等待授权 | 等待 Web/Mobile 授权、查看策略命中原因 | 在 Desktop 二次确认或绕过策略自动执行 |
| `running` | 正在执行 Runtime 或 Action | 查看状态、取消支持时取消 | 重复执行同一请求 |
| `failed` | 执行失败 | 查看原因、重试或回到 Web | 隐藏失败原因 |

### 5.4 Desktop Agent 配置中心与本地 Agent 会话

Agent 配置中心和本地 Agent 会话是 Desktop 的主体验组成部分，参考 AionUi 的 Local Agents 检测卡、AgentCard 和桌面 ChatLayout，以及 codeg 的 ConversationShell 和 MessageInput，但必须服从 AgentHub 的执行域和凭证边界。

必须包含：

- Agent 配置中心：Codex、Claude Code、OpenCode 和其他预留 Runtime 卡片。
- P0 已接入：Codex、Claude Code。展示安装状态、版本、CLI path、认证状态、能力标签、最近诊断和进入会话动作。
- P0 待接入：OpenCode 和其他 Runtime。展示“待接入”状态、不可进入会话、不可编辑密钥。
- 本地 Agent 卡片：Claude Code、Codex 的安装状态、版本、CLI path、认证状态、能力标签、最近诊断。
- 进入会话动作：仅当 Runtime `installed` 且认证状态可用时可进入；不可用时展示本机修复引导和重新检测。
- 轻量消息区：展示当前 Local Desktop Workspace 最近消息、Runtime 流式输出、执行活动、失败原因和本机策略审计记录。
- 轻量输入框：允许发送与当前 Workspace 绑定的本机轻量指令，例如诊断、继续、重试、停止或查看状态；不承载完整多 Agent 任务流。
- Web 工作台入口：复杂 Artifact、Context、Agents、Preview、代码编辑、跨 Session 管理、Orchestrator 主流程和发布部署跳转 Web 完成。

禁止行为：

- 不在本地 Agent 会话中保存或要求填写 `ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、Base URL 或敏感环境变量。
- 不绕过云端后端和 DeviceChannel 直接把 renderer 文本交给 shell 执行。
- 不复制 Web 三栏工作台，不在 Desktop 承载完整 Artifact/Context/Agents/Preview、跨 Session 管理、复杂代码编辑或发布部署。

对应需求：`FR-DESK-001`, `FR-CHAT-001`, `FR-RUNTIME-001`, `FR-PERM-001`, `FR-UI-001`。

对应需求：`FR-DESK-001`, `FR-RUNTIME-001`, `FR-ACTION-001`, `FR-PERM-001`。

---

## 6. Mobile 产品设计

### 6.1 Mobile 定位

Mobile 是远程监督控制端。

它让用户在离开电脑时查看 Agent 线程、Run、diff、测试结果、artifact、回复澄清问题、授权命令或权限动作、打开预览链接。它不承担 Runtime Connector、本地文件凭证、完整代码编辑和复杂 Diff 合并。

对应需求：`FR-MOB-001`, `FR-NOTIFY-001`, `NFR-UX-002`。

### 6.2 Mobile 页面地图

| 页面 | P0/P1 | 说明 | 绑定需求 |
| --- | --- | --- | --- |
| 登录页 | P0 | GitHub OAuth 登录 | `FR-AUTH-001` |
| Workspace 列表 | P0 | 查看 Workspace、执行域和连接状态 | `FR-WS-001`, `FR-DEVICE-001` |
| Session 列表 | P0 | 查看最近会话、待确认提示 | `FR-CHAT-001`, `FR-NOTIFY-001` |
| 轻量 Session 页 | P0 | 消息流、文本回复、@ Role Agent、结果卡片摘要 | `FR-MOB-001`, `FR-CHAT-001` |
| 授权详情页 | P0 | 查看执行域、策略命中原因、风险、影响范围，并进行本次或 Session 范围授权 | `FR-PERM-001`, `FR-NOTIFY-001` |
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
6. 用户可确认计划、要求修改计划、停止，或明确授权本 Session 自动推进。
7. 后端校验 Plan DAG：无环、Role Agent 合法、Runtime 执行域一致、未知依赖不可执行。
8. Orchestrator 为 ready 节点构造 Context Package 并分派给 Role Agent；同一并行组内无冲突节点可以同时执行。
9. Role Agent 执行并回传节点状态。
10. Orchestrator 在节点完成后重新计算 ready、waiting、blocked、failed。
11. 对产品交付类任务，系统在实现角色完成后插入 `产物助手收口` 节点。产物助手判断任务属于网页/服务启动脚本、Markdown 文档、PPT、图片或混合产物，创建一个主产物和若干辅助产物，并在 IM 中生成预览/发布卡。
12. Orchestrator 或架构师基于产物助手的收口结果做最终汇总，并给出下一步建议。

计划卡 P0 展示规则：

- 以列表或分组形式展示 Plan DAG，不做复杂拖拽式 DAG 编辑器。
- 每个节点展示 Role Agent、目标、依赖、状态、预期产物和风险等级。
- 并行节点用同一分组或「可并行」标识展示。
- 节点失败时展示受影响的等待节点，并提供重试、跳过、调整计划、停止。
- 产品交付类计划展示 `产物助手收口`，但把它标识为交付收口节点，而不是普通实现角色。
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
2. 系统根据 Workspace/Session 策略、执行域策略和本机策略判断是否需要授权。
3. 需要授权时，在当前 Session 中生成授权卡；Web/Mobile 是授权入口，Desktop 不弹二次确认。
4. 用户授权后执行：
   - Cloud Workspace：云端 Runtime 执行。
   - Local Desktop Workspace：Desktop Connector 执行。
5. Action 状态卡展示 pending、running、succeeded、failed、canceled。
6. 成功后结果卡片可展示 preview URL 或执行输出摘要。

对应需求：`FR-ACTION-001`, `FR-PERM-001`, `FR-NOTIFY-001`, `FR-RESULT-001`。

### 7.9 Mobile 远程监督、授权与回复

1. 用户在 Mobile 收到需要授权提示，或打开授权记录/待处理项。
2. 授权详情展示来源 Workspace、Session、Run、触发消息、执行域、策略命中原因、风险说明和可选动作。
3. 用户选择仅本次允许、本 Session 允许、取消或跳转 Web 调整长期策略。
4. 系统把授权结果同步回对应 Session；Desktop 只同步策略并执行已授权请求。
5. 用户也可在轻量 Session 页查看 Run、diff、artifact、测试结果，并直接回复 Orchestrator 澄清问题或 @ Role Agent。

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

- 确认计划。
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

### 8.4 Authorization Card

字段：

- 请求方 Role Agent 或 Orchestrator。
- Action 类型。
- Workspace 与 Session。
- 执行位置：Cloud 或 Local Desktop。
- 风险等级。
- 请求原因。
- 影响范围，例如工作目录、命令摘要、受限路径。

操作：

- 授权本次。
- 取消。
- 查看详情。

P0 不提供：

- 永久信任某命令。
- 复杂策略编辑器。
- 多人联合授权流。

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
- 文档预览。
- 演示稿预览。
- 发布/运行状态。
- 主产物候选和辅助产物。

统一操作：

- 展开。
- 复制。
- Pin。
- Handoff 给 Role Agent。
- 打开预览或全屏预览。
- 下载文件。
- 服务型主产物可启动、打开 URL、停止并查看失败原因。

代码块要求：

- 语法高亮。
- 一键复制。
- 复制成功反馈。

Diff 要求：

- 作为展示材料出现。
- 支持展开查看。
- 不单独触发授权。

产物助手交付卡要求：

- 由 `产物助手` 作为消息作者或结果角色展示，不由架构师代写产物列表。
- 只显示一个主启动/发布入口；混合输出中的 Markdown、PPT、图片和静态文件显示为辅助产物。
- 标准权限下，启动服务或执行发布命令必须等待用户点击并通过权限卡确认。
- 完全权限下，服务型主产物可以自动启动，但聊天流仍显示自动通过的权限审计和 `running` / `failed` 发布状态。
- 右侧 Artifacts 列表读取同一批 durable artifact rows，不能用本地按钮另建不在聊天记录里的产物。

对应需求：`FR-ARTIFACT-001`, `FR-PERM-001`。

### 8.7 Authorization Inbox

能力：

- 跨 Workspace 展示需要授权项和授权记录。
- 按时间倒序。
- 标记来源 Workspace、Session、消息、Run、任务或 Action。
- 支持跳转到原 Session。
- 支持本次授权、Session 范围授权、取消或跳转 Web 调整长期策略。
- Desktop 不提供该授权入口，只展示与本机执行相关的策略镜像、执行日志和本机策略审计记录。

授权类型：

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
8. 用户确认计划。
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
- Mobile 轻量 IM、远程监督授权和预览。
- Direct Role Flow 与 Orchestrated Flow。
- Orchestrator 计划卡和默认确认。
- Role Agent 模板与配置。
- Claude Code、Codex 的本地 Runtime 展示和绑定入口。
- Markdown 渲染、代码块高亮和复制。
- 图片、文件引用、网页预览、Diff、Action 状态、结果卡片。
- 当前 Session 授权动作与变更记录。

### 11.2 P1 可增强

- Session 搜索、置顶、归档、恢复和按最近活跃排序。
- Role Agent 工具集配置。
- 从一句需求创建新项目。
- Desktop 系统通知和 Mobile Push。
- Web 基础代码查看增强。

### 11.3 Bytedance 后续完整产品 backlog

以下能力来自 Bytedance 原始材料或讲解转写。它们可以晚于当前 MVP 实现，但不能从产品范围中删除：

- 完整 IM 消息操作：回复、引用、重新生成、一键应用 Diff、展开预览。
- 高级产物体验：全屏预览、代码编辑器、版本历史、选中代码或文档片段后对话式修改。
- 富文档与演示文稿：Markdown、飞书文档、文档渲染和 PPT 浏览/预览/编辑。
- 部署发布：聊天中发起部署、部署状态卡片、预览 URL、静态站点部署、容器化部署、源码打包下载、小程序/飞书等第三方发布 Action。
- 多端完整化：Web 全功能、Desktop 本地文件访问/系统通知/Agent 进程管理、Mobile 轻量 IM/审批/产物预览。当前 PWA/Connector 能力只是阶段实现。
- OpenCode Runtime Adapter：与 Claude Code/Codex 同一 Runtime/Adapter 模型接入。
- 多真人协作：多人 Workspace/Session、成员权限、并发审批和冲突处理。
- Agent Marketplace：可发现、可安装、可审查权限和 Runtime 要求的 Agent 模板。
- 非 Git checkpoint、snapshot、patch stack、回滚和跨 Agent 冲突处理。

对应需求：`FR-IM-101`, `FR-AGENT-101`, `FR-WORKSPACE-101`, `FR-NOTIFY-101`, `FR-COLLAB-201`, `FR-MARKET-201`, `FR-RUNTIME-201`, `FR-VERSION-201`, `FR-DOCS-201`, `FR-PUBLISH-201`。

---

## 12. 与技术设计的交接关系

产品设计中的待定技术问题已在 `research/architecture/technical-design.md` 和 `research/modules/*.md` 中收敛。本节保留为产品设计到技术设计的交接索引。

| 产品问题 | 技术设计结论 | 主章节 |
| --- | --- | --- |
| Desktop Connector 使用 Electron 还是 Tauri | P0 使用 Electron；Tauri 作为 P2 评估项 | `research/architecture/technical-design.md` 第 2、15.2 章 |
| Mobile P0 是响应式 Web/PWA 还是独立移动壳 | P0 使用响应式 Web/PWA；Android App 预留 Capacitor | `research/architecture/technical-design.md` 第 2、15.3 章 |
| Claude Code/Codex 如何保持原生会话连续 | Desktop Connector 调 CLI 子进程，记录 native session ID，优先 resume/continue | `research/architecture/technical-design.md` 第 10、12 章 |
| Cloud Workspace 与 Local Desktop Workspace 如何隔离 | Workspace 创建后执行域不可变，Runtime/Action 必须匹配执行域 | `research/architecture/technical-design.md` 第 5 章 |
| Action/CLI Adapter 如何请求、确认和回传 | 使用统一 `ActionRequest`、权限矩阵和 Runtime/Action 事件 | `research/architecture/technical-design.md` 第 13、16 章 |
| 授权动作通过什么通道同步 | 数据库为真相源，database-backed realtime 同步状态；Desktop 执行请求走 DeviceChannel | `research/architecture/technical-design.md` 第 8、9、13 章 |
| 三端代码如何共享 | `packages/shared` 承载领域模型、协议和状态机；不承诺 Web UI 组件迁移到 React Native | `research/architecture/technical-design.md` 第 3、15 章 |

对应需求：`FR-DEVICE-001`, `FR-RUNTIME-001`, `FR-ACTION-001`, `FR-NOTIFY-001`。
