# AgentHub 总体 PRD

**作者：** joytion, Codex  
**日期：** 2026-05-21  
**状态：** Draft  
**版本：** 0.1  
**原始素材：** `bytedance_init_prd.md`, `bytedance_init_video_txt.txt`  
**方法论参考：** `how_to_prd/prd-taskmaster/SKILL.md`, `how_to_prd/ai-dev-tasks/create-prd.md`

---

## 1. 摘要

AgentHub 是一个以 IM 聊天为核心交互范式的多 Agent 协作平台。

用户在绑定项目工作区后，与不同角色 Agent 协作。Orchestrator 负责澄清需求、拆解计划、分派任务；文件变更、Git diff、命令执行输出和预览链接等代码相关产物，最终回到聊天流中展示。

产品采用 Trae-like 的多端模型：Web 是主工作台，Desktop 是连接用户本地开发环境的 Connector，Mobile 是轻量 IM、审批、预览和远程控制端。

MVP 必须证明 Web、Desktop、Mobile 配合完成一次端到端开发任务，同时为后续部署发布、Agent Marketplace、版本控制增强和更多 Runtime Adapter 保留扩展空间。

---

## 2. 基于原始素材的产品定位

### 2.1 原始素材明确要求

从 `bytedance_init_prd.md` 和课题讲解转写中，可以提取出以下产品方向：

- AgentHub 是一个多 Agent 协作平台的简化实战版，用对话式交互创建网页、Workflow、代码、文档等产物。
- IM 聊天是核心交互模型。用户通过新建对话、发送消息、@ Agent、多轮迭代来完成任务。
- Agent 应该像协作成员一样存在。用户可以与单个 Agent 单聊，也可以在一个会话中拉入多个 Agent 群聊协作。
- 主 Agent，也就是 Orchestrator，应理解用户意图、澄清需求、拆解任务、分派子 Agent、汇总结果，并在产品层面处理失败或冲突。
- 产品需要接入主流 Agent 平台。原始素材提到 Claude Code、Codex、OpenCode；本 PRD 将 MVP Runtime 范围收敛为 Claude Code 和 Codex。
- Agent 产物应内联展示在聊天中。MVP 收敛为开发产物：任务结果卡片、文件变更摘要、Git diff、必要时的命令执行输出和预览链接。
- AI 协作过程记录是评审重点。仓库应形成 specs、skills、rules、开发工作流文档，而不是提交完整聊天记录。
- 多端支持是产品方向。Web 是完整主功能区；Desktop 提供本地文件、通知、Agent 进程能力；Mobile 提供轻量 IM、审批确认和产物预览。

### 2.2 产品解释

AgentHub 不是泛聊天机器人，而是围绕项目工作区组织多 Agent 协作的开发生产力平台。

用户看到的核心抽象是：

- **Role Agent：** 用户可 @、可配置、可被 Orchestrator 调度的角色，例如 Orchestrator、前端工程师、测试、代码审查、PM。
- **Runtime：** Role Agent 背后的执行后端，例如平台托管模型、本地 Claude Code、本地 Codex。
- **Adapter：** 将 AgentHub 的消息、上下文包、Runtime 请求和执行事件转换为具体 Runtime 可处理格式的接入层。

Claude Code 和 Codex 在本产品中不是简单的文本生成 API。

接入它们的原因是用户需要复用原生会话上下文：AgentHub 应把某个 Role Agent 会话绑定到对应 Claude Code / Codex 原生 session，并在能力允许时使用 resume/continue 实现持续对话。

---

## 3. 目标与成功指标

### 目标 1：跑通端到端多 Agent 开发流程

- **指标：** Demo 主路径完成率。
- **目标：** 用户在初始环境配置完成后，可以不依赖手工改数据库、手工 patch 代码或隐藏步骤，完成 P0 Demo 路径。
- **衡量方式：** 手工 Demo checklist，必要处补充自动化集成检查。

### 目标 2：建立清晰的三端产品模型

- **指标：** 每个端都有明确、可演示、互不混淆的职责。
- **目标：** Web、Desktop、Mobile 都在 MVP 中存在，并分别完成其 P0 职责。
- **衡量方式：** 产品 Demo 和验收 checklist。

### 目标 3：证明真实 Runtime 接入能力

- **指标：** Claude Code 和 Codex 可以通过统一 Runtime/Adapter 模型接入。
- **目标：** Role Agent 可以通过 Desktop Connector 绑定到本地 Claude Code 或 Codex，并且后续消息在能力允许时继续同一个原生 session。
- **衡量方式：** Runtime Adapter 集成测试或手工 Runtime 验证。

### 目标 4：让 AI 协作过程可解释

- **指标：** 用户能看到任务计划、角色分派、上下文 handoff、任务结果卡片、文件变更和必要的执行输出。
- **目标：** 用户能解释 Orchestrator 做了什么决定、哪个 Role Agent 执行了什么任务、改了什么、还有哪些动作需要确认。
- **衡量方式：** Demo 评审和 PRD 验收标准。

---

## 4. 目标用户

### 主要用户

使用 AI 辅助开发软件项目的个人开发者或参赛学生。TA 在 Web 中使用主工作台，在自己的开发机上运行 Desktop Connector，也可以用 Mobile 查看进度、轻量回复或审批动作。

### 次要用户

使用云端 AgentHub Workspace 的用户。此时 Workspace 仍然必须绑定一个云端项目目录或个人云工作区。云端执行替代本地 Desktop 执行，但产品模型仍然是项目工作区绑定。

### MVP 非目标用户

多个真人用户同时在同一个 Workspace 或 Session 中协作。多人真人协作是 P2 能力。

---

## 5. 核心概念

| 概念 | 定义 |
| --- | --- |
| User | 通过 GitHub OAuth 登录的用户。 |
| Workspace | 项目绑定的工作区。必须绑定本地文件夹或云端项目目录，并在创建时确定执行域：Cloud 或 Local Desktop。 |
| Session | Workspace 内的一条任务会话，包含消息、参与 Role Agent、Orchestrator 计划、上下文包、任务状态和结果卡片。 |
| Role Agent | 用户可见的角色 Agent，例如 Orchestrator、前端工程师、测试、代码审查。 |
| Runtime | Role Agent 的执行后端，例如平台托管 Runtime、本地 Claude Code、本地 Codex。Runtime 必须与 Workspace 执行域一致。 |
| Adapter | Runtime 专属接入层，负责发送消息、恢复 session、流式回传状态、接收结果事件。 |
| Orchestrator | PM 型 Role Agent，负责澄清需求、生成计划、请求确认、分派角色、汇总结果。 |
| Context Package | 上下文 handoff 载荷，包含任务摘要、pin 消息、相关文件、前序 Agent 结论和当前目标。 |
| Rich Message / Artifact | 聊天中的富内容消息或产物，包括 Markdown、代码块、图片、文件附件、网页预览、Diff 卡片和 Action 状态卡。 |
| Task Result Card | 角色任务完成时在聊天中产生的结果卡片，可展示状态、摘要、文件变更、Git diff、预览链接和必要执行输出。 |
| Action/CLI Adapter | 用于预览、构建、测试、部署等命令型操作的兼容层。 |

---

## 6. 主用户旅程

1. 用户使用 GitHub OAuth 登录。
2. 用户通过绑定已有项目或创建新文件夹来创建 Workspace。
3. 用户打开 Web 三栏 IM 工作台。
4. 用户启动 Desktop Connector，并绑定到同一账号。
5. Desktop Connector 检测本地 Claude Code 和 Codex 可用性。
6. 用户创建 Session，并选择参与的 Role Agent。
7. 用户发送任务：未 @ 角色时默认进入 Orchestrated Flow；明确 @ 单个 Role Agent 时进入 Direct Role Flow；@ 多个 Role Agent 或 @ Orchestrator 时进入 Orchestrated Flow。
8. Direct Role Flow 中，目标 Role Agent 直接处理任务；Orchestrated Flow 中，Orchestrator 在必要时澄清需求，然后生成执行计划和角色分工。
9. Orchestrated Flow 默认要求用户确认计划，或由用户明确授权自动推进。
10. Role Agent 通过各自配置的 Runtime 和 Adapter 执行。
11. 聊天流展示 Agent 消息、任务状态、结果卡片、文件变更、Git diff、预览链接，以及必要时的执行输出。
12. 用户继续对话、pin 关键上下文、要求某个 Role Agent 继续修改、审批权限升级或结束任务。
13. Mobile 可在同一流程中查看进度、发送轻量消息、完成待确认动作。

---

## 7. Requirement Registry

### P0: MVP 需求

#### FR-AUTH-001: GitHub OAuth 登录

**描述：** 系统必须允许用户通过 GitHub OAuth 登录。MVP 不实现独立用户名密码体系。

**验收标准：**

- [ ] 用户可以从 Web、Desktop、Mobile 发起登录。
- [ ] GitHub OAuth 登录成功后，系统创建或恢复同一个 AgentHub 用户身份。
- [ ] 同一个用户身份可以在 Web、Desktop、Mobile 访问相同 Workspace 和 Session。
- [ ] 用户在某个设备退出登录后，该设备不能继续访问受保护的 Workspace 和 Session 数据。
- [ ] MVP 不要求邮箱密码、Magic Link 或自建 2FA。

**依赖：** 无。

#### FR-WS-001: Workspace 必须绑定项目工作区

**描述：** 每个 Workspace 都必须绑定一个明确的项目工作区，并在创建时选择唯一执行域。

本地模式绑定 Desktop Connector 选择的本地文件夹；云端模式绑定云端项目目录或个人云工作区。同一个 Workspace 内不能混用本地执行和云端执行。

**验收标准：**

- [ ] 用户可以选择已有本地或云端项目目录来创建 Workspace。
- [ ] 用户可以输入 Workspace 名称和文件夹名来创建新 Workspace。
- [ ] Session 不能脱离 Workspace 单独存在。
- [ ] Workspace 详情页展示该 Workspace 的执行域是 Cloud 还是 Local Desktop。
- [ ] 一个 Workspace 创建后，其 Session、Role Agent Runtime、Action 执行位置必须继承该 Workspace 的执行域。
- [ ] Cloud Workspace 的执行只作用于云端项目目录，不影响用户本地文件。
- [ ] 本地 Workspace 在没有在线 Desktop Connector 时不能执行本地任务。
- [ ] Local Desktop Workspace 只能通过已认证且在线的 Desktop Connector 读写用户授权的本地目录。
- [ ] 云端 Workspace 使用云端 Runtime 和云端项目存储，不走本地 Desktop 执行。
- [ ] 同一个 Workspace 或 Session 内不能同时使用 Cloud Runtime 和 Local Desktop Runtime。

**依赖：** FR-AUTH-001。

#### FR-DEVICE-001: 三端产品形态

**描述：** MVP 必须包含 Web、Desktop、Mobile 三端，且三端职责不同。三端共享账号、Workspace、Session、Agent、权限和消息数据，但不暴露完全相同的功能。

**验收标准：**

- [ ] Web 提供完整三栏 IM 工作台。
- [ ] Desktop 提供 Connector Console：账号绑定、文件夹绑定、Runtime 检测、本地 Action 执行、连接状态展示。
- [ ] Mobile 提供轻量 IM、任务进度、审批和预览。
- [ ] Web 和 Mobile 可以作为 Local Desktop Workspace 的控制端发送消息、审批和 Action 指令，但本地文件读写、命令执行和 Runtime 调用必须落在已认证且在线的 Desktop Connector。
- [ ] 系统不能在没有已认证 Desktop Connector 的情况下声称可以控制用户本地 Workspace，也不能把 Web/Mobile 进程作为本地文件或本地端口访问入口。

**依赖：** FR-AUTH-001, FR-WS-001。

#### FR-WEB-001: Web 三栏 IM 工作台

**描述：** Web 是完整主工作台。它必须以 IM 协作为中心，同时在聊天周边承载上下文和产物。

**验收标准：**

- [ ] 左栏支持 Workspace 切换和 Session 列表。
- [ ] 中栏支持消息流、用户消息、Role Agent 流式消息、Orchestrator 计划卡、确认卡、任务结果卡片。
- [ ] 右栏可切换 Artifacts、Context、Agents、Preview 视图。
- [ ] 用户可以从 Web 创建 Session。
- [ ] 用户可以在输入框中 @ Role Agent。
- [ ] 用户可以查看任务结果卡片中的状态、摘要、文件变更、Git diff、预览链接和必要执行输出。

**依赖：** FR-WS-001, FR-CHAT-001, FR-RESULT-001。

#### FR-DESK-001: Desktop Connector Console

**描述：** Desktop 是本地 Connector Console，不是完整 Web 工作台的复制品。它负责把用户自己的本地开发环境连接到 AgentHub。

**验收标准：**

- [ ] Desktop 支持 GitHub 登录或绑定同一 AgentHub 账号。
- [ ] Desktop 可以绑定本地 Workspace 文件夹。
- [ ] Desktop 可以检测本地 Claude Code 和 Codex 可用性，并展示连接状态。
- [ ] Desktop 可以展示 Connector 是否在线、是否可被云端后端触达。
- [ ] Desktop 可以执行已批准的本地 Runtime 和 Action 请求。
- [ ] Desktop 展示最近任务执行、执行状态和失败原因。
- [ ] Desktop 提供打开 Web 工作台的入口。

**依赖：** FR-AUTH-001, FR-WS-001, FR-RUNTIME-001, FR-ACTION-001。

#### FR-MOB-001: Mobile 轻量 IM、审批与预览

**描述：** Mobile 是轻量 IM 和远程控制端，不承担完整代码编辑器或 Runtime Connector 职责。

**验收标准：**

- [ ] 用户可以查看 Workspace 和 Session 列表。
- [ ] 用户可以查看聊天消息、Role Agent 状态和任务结果卡片。
- [ ] 用户可以发送轻量文本消息。
- [ ] 用户可以 @ Role Agent。
- [ ] 用户可以审批或拒绝 Orchestrator 计划、权限升级、部署或 Action 确认、失败任务重试请求。
- [ ] 用户可以查看预览链接和轻量产物摘要。
- [ ] Mobile 不提供本地 Claude Code 或 Codex Runtime 接入。
- [ ] Mobile 不提供复杂代码编辑或大屏 Diff 合并流程。

**依赖：** FR-AUTH-001, FR-CHAT-001, FR-PERM-001, FR-NOTIFY-001。

#### FR-CHAT-001: 核心 IM Session 体验

**描述：** 系统必须支持围绕项目工作的 IM 式交互。

MVP 中的群聊指一个真人用户与多个 Role Agent 协作，不包含多个真人用户同时参与。消息路由必须符合 IM 使用习惯：用户明确 @ 谁就优先找谁；未指定角色或需要多角色协作时由 Orchestrator 接住。

**验收标准：**

- [ ] 用户可以在 Workspace 内创建新 Session。
- [ ] 用户可以发起单 Role Agent 对话。
- [ ] 用户可以发起多 Role Agent 群聊 Session。
- [ ] 用户可以 @ 一个或多个 Role Agent。
- [ ] 用户未 @ 任何 Role Agent 时，消息默认进入 Orchestrated Flow。
- [ ] 用户明确 @ 单个 Role Agent 时，消息默认进入 Direct Role Flow，不强制先走 Orchestrator。
- [ ] 用户 @ 多个 Role Agent 时，消息默认进入 Orchestrated Flow，由 Orchestrator 负责分工、上下文包和汇总。
- [ ] 用户显式 @ Orchestrator 时，消息必须进入 Orchestrated Flow。
- [ ] 消息支持文本、基础 Markdown 渲染和 Role Agent 流式回复。
- [ ] 消息状态可以区分 pending、streaming、completed、failed、requires confirmation。
- [ ] 用户可以复制消息内容。
- [ ] 用户可以对失败的 Role Agent 回复执行重新生成或重试。
- [ ] 多真人聊天、已读回执、消息级真人权限不属于 P0。

**依赖：** FR-WS-001, FR-AGENT-001。

#### FR-AGENT-001: Role Agent 配置

**描述：** 用户与 Role Agent 交互，而不是直接与 Claude Code 或 Codex 这类工具名交互。Role Agent 可以从模板创建、编辑并绑定 Runtime。

**验收标准：**

- [ ] 系统内置 Orchestrator、前端工程师、测试、代码审查、PM 型助手等 Role Agent 模板。
- [ ] 用户可以从模板创建 Role Agent。
- [ ] 用户可以编辑 Role Agent 的名称、头像、能力标签、System Prompt、Runtime 绑定、是否允许被 Orchestrator 调度。
- [ ] 用户可以用自然语言创建 Role Agent 草稿，并在确认后保存。
- [ ] Runtime 名称只在配置和诊断中展示，不作为主要聊天对象。
- [ ] Agent Marketplace 不属于 P0。

**依赖：** FR-RUNTIME-001。

#### FR-RUNTIME-001: 统一 Runtime 和 Adapter 模型

**描述：** 系统必须用统一模型承载平台托管 Runtime 和用户自带 Runtime。

MVP Runtime 范围包括平台托管角色、本地 Claude Code、本地 Codex。Runtime 选择必须受 Workspace 执行域约束：Cloud Workspace 只能使用云端 Runtime；Local Desktop Workspace 只能使用 Desktop Connector 暴露的本地 Runtime。

**验收标准：**

- [ ] Role Agent 可以绑定平台托管 Runtime。
- [ ] Role Agent 可以通过 Desktop Connector 绑定本地 Claude Code。
- [ ] Role Agent 可以通过 Desktop Connector 绑定本地 Codex。
- [ ] Role Agent 的 Runtime 绑定必须与所属 Workspace 执行域一致。
- [ ] Cloud Workspace 内的 Role Agent 不能绑定本地 Claude Code 或 Codex。
- [ ] Local Desktop Workspace 内的 Role Agent 不能绑定云端 Runtime。
- [ ] Orchestrator 分派任务时不能跨 Workspace 执行域混用 Runtime。
- [ ] Adapter 接收结构化消息和上下文包，而不是只接收一段裸 prompt。
- [ ] Adapter 可以把 Role Agent 响应状态流式回传到 Session。
- [ ] Runtime 支持时，Adapter 记录 native session identity。
- [ ] Runtime 支持时，后续消息必须对同一个 Claude Code 或 Codex native session 使用 resume/continue。
- [ ] OpenCode Runtime 不属于 P0，但 Adapter 模型不能阻碍后续接入 OpenCode。

**依赖：** FR-DESK-001, FR-AGENT-001, FR-CTX-001。

#### FR-ORCH-001: Orchestrator 计划与分派

**描述：** Orchestrator 是 PM 型 Role Agent。它必须澄清需求、生成计划、默认请求用户确认，并把任务分派给绑定了 Runtime 的 Role Agent。

Orchestrator 不是所有消息的强制入口；它只在未指定角色、用户显式 @ Orchestrator、用户 @ 多个 Role Agent、或 Direct Role Flow 需要升级时介入。

**验收标准：**

- [ ] Orchestrator 可以在计划前提出澄清问题。
- [ ] 未指定 Role Agent 的用户消息默认由 Orchestrator 接收并判断是否需要追问、计划或分派。
- [ ] 单 Role Agent Direct Role Flow 中，目标 Role Agent 可以提示用户将任务升级给 Orchestrator 重新规划。
- [ ] Direct Role Flow 升级为 Orchestrated Flow 前必须得到用户确认，除非用户已经在 Session 中授权自动推进。
- [ ] Orchestrator 可以生成结构化计划，包含步骤、依赖关系、可并行节点、分派 Role Agent、预期产物、权限敏感动作。
- [ ] Orchestrator 计划必须支持后端校验：无环、Role Agent 属于当前 Workspace、Runtime 与 Workspace 执行域一致、未知依赖不得执行。
- [ ] Orchestrator 可以按计划依赖分派 ready 节点；无依赖冲突的节点可以并行派发。
- [ ] 默认情况下，执行前必须请求用户确认。
- [ ] 用户可以明确授权某个 Session 自动推进。
- [ ] 即使在自动模式下，高风险或超过策略的动作仍需权限确认。
- [ ] Orchestrator 可以分派任务给 Role Agent，并按节点汇总结果。
- [ ] Orchestrator 可以在节点失败时识别受影响的后续节点，并询问用户选择重试、跳过、调整计划或停止。

**依赖：** FR-AGENT-001, FR-RUNTIME-001, FR-PERM-001。

#### FR-CTX-001: 上下文 Pin 与角色 Handoff

**描述：** 系统必须让上下文传递可见、可控。用户不应为了让下一个 Role Agent 理解背景而反复重述历史。

**验收标准：**

- [ ] 用户可以 pin 关键消息作为 Session 长期上下文。
- [ ] Orchestrator 可以为分派给 Role Agent 的任务构造上下文包。
- [ ] 上下文包可以包含任务摘要、pin 消息、相关文件、前序角色结论和当前目标。
- [ ] 用户可以选择消息、文件或结果卡片并交给某个 Role Agent。
- [ ] Handoff 目标是 Role Agent，不是 Runtime 工具名。
- [ ] 如果目标 Role Agent 绑定 Claude Code 或 Codex，Adapter 在能力允许时尝试继续对应 native session。
- [ ] 自动历史摘要不属于 P0。

**依赖：** FR-CHAT-001, FR-RUNTIME-001。

#### FR-ARTIFACT-001: 富消息与产物查看

**描述：** 系统必须支持基础富消息渲染和产物查看能力，使 Agent 回复不仅是纯文本，也能内联展示开发协作需要的关键内容。

P0 重点是查看、复制、展开和引用，不实现复杂编辑器或完整发布平台。

**验收标准：**

- [ ] 聊天消息支持基础 Markdown 渲染，包括标题、列表、引用、链接、表格和代码块。
- [ ] 代码块支持语法高亮和一键复制。
- [ ] 图片可以作为聊天消息或产物附件预览。
- [ ] 文件附件或文件引用可以在聊天中展示文件名、类型、大小或来源。
- [ ] 网页预览可以以卡片形式展示标题、状态和 preview URL。
- [ ] Diff 可以以卡片形式展示，并支持展开查看详细 diff。
- [ ] Action 状态可以以卡片形式展示 pending、running、succeeded、failed、canceled 等状态。
- [ ] 用户可以点击富内容卡片，在 Web 右侧 Artifact 或 Preview 面板中展开查看。
- [ ] 用户可以将富内容卡片作为上下文 handoff 给某个 Role Agent。
- [ ] Web P0 支持基础代码查看；复杂代码编辑器、版本历史、局部选区编辑属于 P1/P2。
- [ ] 部署状态卡片在 P0 仅作为 Action 状态展示；完整部署平台属于 P2。

**依赖：** FR-CHAT-001, FR-CTX-001, FR-ACTION-001。

#### FR-RESULT-001: 任务结果卡片

**描述：** 当角色任务完成或失败时，系统必须在聊天中展示任务结果卡片。这是产品展示组件，不是版本控制系统。

**验收标准：**

- [ ] 结果卡片展示任务状态和结果摘要。
- [ ] 如果存在文件变更，结果卡片展示变更文件列表。
- [ ] 如果 Git diff 可用，结果卡片展示 Git diff。
- [ ] 如果存在预览，结果卡片展示预览链接。
- [ ] 只有当 Runtime 或 Action 执行了命令、测试、构建、预览或部署时，结果卡片才展示对应执行输出。
- [ ] AI 对话文本仍作为普通聊天消息展示，不复制成日志。
- [ ] P0 不实现 snapshot、checkpoint 对比、回滚或非 Git 版本控制。

**依赖：** FR-RUNTIME-001, FR-ACTION-001, FR-ARTIFACT-001。

#### FR-ACTION-001: 用于预览和未来部署的 Action/CLI Adapter

**描述：** 系统必须通过 Action/CLI Adapter 处理预览、构建、测试、部署等命令型操作。MVP 只承诺 Demo 主路径需要的本地预览和命令执行。

**验收标准：**

- [ ] Action request 包含命令或动作标识、工作目录、请求方、Workspace、Session 和权限等级。
- [ ] 策略要求时，用户必须先批准 Action 才能执行。
- [ ] 本地 Workspace 的本地 Action 由 Desktop Connector 执行。
- [ ] 云端 Workspace 的云端 Action 由 Cloud Runtime 执行。
- [ ] Action 状态可以是 pending、running、succeeded、failed、canceled。
- [ ] Action 执行输出可以附加到任务结果卡片。
- [ ] MVP 支持本地预览类 Action，例如启动 dev server 或返回 preview URL。
- [ ] 静态站、容器、小程序、飞书和第三方发布属于 P2 扩展 Action。

**依赖：** FR-DESK-001, FR-PERM-001。

#### FR-PERM-001: Workspace 与 Session 权限策略

**描述：** 权限必须在 Workspace 和 Session 两级控制。确认动作应绑定到任务执行和权限升级，而不是绑定到 Git diff 这类展示材料。

**验收标准：**

- [ ] Workspace 可以定义默认执行策略。
- [ ] Session 可以覆盖 Workspace 默认执行策略。
- [ ] Session 策略不能绕过系统定义的高风险确认规则。
- [ ] 动作超过当前策略时，系统必须请求用户确认。
- [ ] 高风险动作包括 shell 命令执行、受限路径访问、删除、覆盖、批量修改、部署或发布、长时间任务、异常高 token 或成本消耗。
- [ ] Orchestrator 计划确认是任务级确认。
- [ ] 权限升级确认是权限级确认。
- [ ] Git diff 展示不是单独的审批类型。

**依赖：** FR-WS-001, FR-ORCH-001, FR-ACTION-001。

#### FR-NOTIFY-001: 站内通知与待审批队列

**描述：** MVP 必须提供跨端站内通知和待审批队列。这让 Mobile 具备远程控制价值，同时 P0 不需要依赖系统 Push 基建。

**验收标准：**

- [ ] 用户可以从 Web 查看待审批项。
- [ ] 用户可以从 Desktop 查看待审批项。
- [ ] 用户可以从 Mobile 查看待审批项。
- [ ] 待审批项可以定位到产生它的 Workspace、Session、消息、任务或 Action。
- [ ] 审批类型包括 Orchestrator 计划确认、任务结果下一步确认、权限升级确认、部署或发布确认、失败任务重试确认。
- [ ] Desktop 系统通知、Mobile Push、飞书 Hook、微信 Hook 不属于 P0。

**依赖：** FR-PERM-001, FR-MOB-001。

### P1: 近期增强

#### FR-IM-101: Session 管理增强

**描述：** 在核心开发流程跑通后，补齐 IM 体验增强能力。

**验收标准：**

- [ ] 用户可以搜索 Session。
- [ ] 用户可以置顶 Session。
- [ ] 用户可以归档 Session。
- [ ] 用户可以引用或回复某条消息。

**依赖：** FR-CHAT-001。

#### FR-AGENT-101: Role Agent 工具集配置

**描述：** 增强 Role Agent 可以使用哪些工具或 Action 的配置能力。

**验收标准：**

- [ ] 用户可以查看某个 Role Agent 可用的工具或 Action。
- [ ] 用户可以启用或禁用某个 Role Agent 的工具类别。
- [ ] 工具权限必须遵守 Workspace 和 Session 权限策略。

**依赖：** FR-AGENT-001, FR-PERM-001。

#### FR-WORKSPACE-101: 从一句需求创建新项目

**描述：** 支持用户从新项目想法开始，而不是只能绑定已有项目。

**验收标准：**

- [ ] 用户可以提供文件夹名和自然语言项目说明来创建 Workspace。
- [ ] Orchestrator 可以在执行前提出初始化步骤。
- [ ] 创建项目文件前必须由用户确认。

**依赖：** FR-WS-001, FR-ORCH-001, FR-ACTION-001。

#### FR-NOTIFY-101: 外部设备通知

**描述：** 在站内队列之外增加设备级通知。

**验收标准：**

- [ ] Desktop 可以展示本地系统通知。
- [ ] Mobile 在所选技术方案支持时可以接收 Push 通知。
- [ ] 通知 payload 默认不暴露敏感文件内容。

**依赖：** FR-NOTIFY-001。

### P2/P3: 未来兼容能力

#### FR-COLLAB-201: 多真人协作

**描述：** 支持多个真人成员进入同一 Workspace 或 Session。

**验收标准：**

- [ ] Workspace 可以包含多个真人成员。
- [ ] 真人成员拥有角色和权限。
- [ ] Session 支持多个真人参与者。
- [ ] 冲突和并发审批需要显式处理。

**依赖：** FR-WS-001, FR-CHAT-001, FR-PERM-001。

#### FR-MARKET-201: Agent Marketplace

**描述：** 支持可发现、可复用的 Agent 模板。

**验收标准：**

- [ ] 用户可以浏览 Agent 模板。
- [ ] 用户可以把模板安装到 Workspace。
- [ ] 安装前展示模板权限和 Runtime 要求。

**依赖：** FR-AGENT-001。

#### FR-VERSION-201: 非 Git 代码控制与 Checkpoint

**描述：** 引入真正的 snapshot、checkpoint、patch stack、对比和回滚系统。该能力明确不属于 P0 或 P1。

**验收标准：**

- [ ] 系统可以创建独立于 Git commit 的 checkpoint。
- [ ] 用户可以比较 checkpoint。
- [ ] 用户可以回滚到某个 checkpoint。
- [ ] 系统可以检测并展示跨 Agent 变更冲突。

**依赖：** FR-RESULT-001。

#### FR-RUNTIME-201: OpenCode Runtime Adapter

**描述：** 在同一 Runtime/Adapter 模型下增加 OpenCode。

**验收标准：**

- [ ] Role Agent 可以绑定 OpenCode Runtime。
- [ ] OpenCode 暴露 session 连续能力时，Adapter 支持接入。
- [ ] OpenCode 事件可以映射到同一任务状态和结果卡片模型。

**依赖：** FR-RUNTIME-001。

#### FR-DOCS-201: 富文档与演示文稿产物

**描述：** 支持文档、Markdown、飞书文档和 PPT 的预览或编辑。

**验收标准：**

- [ ] Markdown 产物可以预览。
- [ ] 在凭证允许时可以集成飞书文档产物。
- [ ] PPT 产物可以预览。
- [ ] 产物交互可以重新进入 Role Agent handoff 上下文。

**依赖：** FR-CTX-001, FR-RESULT-001。

#### FR-PUBLISH-201: 部署与第三方发布 Action

**描述：** 通过 Action/CLI Adapter 增加部署和发布动作，而不是在产品层硬编码每个发布平台。

**验收标准：**

- [ ] 用户可以配置静态站部署 Action。
- [ ] 用户可以配置容器部署 Action。
- [ ] 用户可以配置源码打包导出。
- [ ] 用户可以配置小程序发布 Action。
- [ ] 用户可以配置飞书发布 Action。
- [ ] 每个发布 Action 都复用 P0 Action/CLI 请求的权限与审批模型。

**依赖：** FR-ACTION-001, FR-PERM-001。

---

## 8. 非功能需求

### NFR-SEC-001: 安全的本地控制边界

AgentHub 的控制面和执行面必须分离。Web 和 Mobile 可以控制 Cloud Workspace，也可以控制 Local Desktop Workspace。

对 Local Desktop Workspace 的影响必须经云端后端下发到已认证且在线的 Desktop Connector，由 Desktop Connector 在用户授权目录内执行。

本地文件读写、命令执行和 Runtime 调用不能发生在 Web/Mobile 进程内，也不能通过浏览器或手机直接访问用户电脑端口完成。

### NFR-SEC-002: 密钥和资源处理

共享或提供的模型/API 资源不能出现在 UI、执行输出、截图、提交文件或导出产物中。用户自带 Runtime 凭证应由本地 Runtime 或选定的云端凭证存储自行管理。

### NFR-UX-001: IM 优先体验

主体验必须像一个与 Agent 协作的 IM 产品，而不是泛 IDE 克隆。代码和产物面板服务于聊天工作流，但不替代聊天。

### NFR-UX-002: 端侧能力适配

Web、Desktop、Mobile 不应暴露相同信息密度。Mobile 避免复杂代码编辑；Desktop 聚焦 Connector 状态和本地执行；Web 提供完整工作台能力。

### NFR-OBS-001: Agent 工作过程可检查

用户必须能检查 Orchestrator 计划、角色分派、任务状态、结果摘要、文件变更、Git diff，以及相关执行输出。

---

## 9. MVP 明确不做

- 多个真人用户在同一 Workspace 或 Session 中协作。
- 完整部署平台。
- Agent Marketplace。
- Snapshot、checkpoint 对比、回滚或非 Git 版本控制。
- OpenCode Runtime。
- 飞书/微信 Hook 集成。
- 小程序或飞书发布。
- 富文档/PPT 编辑。
- 完整 Mobile 代码编辑。
- Desktop 复制完整 Web 工作台。
- 后端持久化远控整台电脑。
- 独立用户名密码登录。

---

## 10. 技术设计阶段待回答问题

1. Desktop Connector 使用 Electron 还是 Tauri？
2. Mobile 在 MVP 中使用响应式 Web/PWA，还是后续共用原生壳？
3. 目标环境中的 Claude Code 和 Codex 分别暴露哪些 native session resume/continue 能力？
4. P0 最小权限策略类别如何设计，才能避免过度实现完整安全引擎？
5. 如果本地 Workspace 是主 Demo 路径，云端 Workspace 存储在 MVP 中应如何表达？

---

## 11. Demo 验收清单

- [ ] 用户使用 GitHub OAuth 登录。
- [ ] 用户创建或绑定 Workspace。
- [ ] Desktop Connector 在线，并绑定同一账号。
- [ ] Desktop Connector 检测到 Claude Code 和 Codex。
- [ ] 用户在 Web 创建包含多个 Role Agent 的 Session。
- [ ] 用户向 Orchestrator 发送任务。
- [ ] Orchestrator 提出澄清问题或生成计划。
- [ ] 用户确认计划，或授权自动推进。
- [ ] 某个 Role Agent 通过配置的 Runtime 执行。
- [ ] Runtime 在能力允许时使用 native session 连续能力。
- [ ] 任务结果卡片展示状态、摘要、文件变更、Git diff、预览链接，以及相关执行输出。
- [ ] Mobile 可以查看同一 Session，发送轻量回复，并完成待确认动作。
- [ ] Web/Mobile 可以对 Local Desktop Workspace 发送任务消息、审批和影响本地文件的 Action 指令；所有本地执行都通过云端后端路由到已认证且在线的 Desktop Connector。

---

## 12. 任务拆解提示

实现阶段应按 FR-ID 创建 Trellis 任务。建议任务组：

| 任务组 | FR 范围 | 说明 |
| --- | --- | --- |
| 身份与 Workspace | FR-AUTH-001, FR-WS-001 | 先建立跨端身份和项目边界。 |
| 共享领域模型 | FR-DEVICE-001, FR-AGENT-001, FR-RUNTIME-001 | 在 UI 分化前定义数据契约。 |
| Web 工作台 | FR-WEB-001, FR-CHAT-001, FR-ARTIFACT-001, FR-RESULT-001 | 建设主 Demo 界面和富内容查看能力。 |
| Desktop Connector | FR-DESK-001, FR-ACTION-001 | 本地 Runtime 执行的必要前提。 |
| Runtime Adapters | FR-RUNTIME-001, FR-CTX-001 | Claude Code 和 Codex 上下文连续是核心差异点。 |
| Orchestrator | FR-ORCH-001, FR-CTX-001, FR-PERM-001 | 计划、handoff 和审批。 |
| Mobile Surface | FR-MOB-001, FR-NOTIFY-001 | 轻量 IM、审批和预览。 |
| 兼容性预留 | FR-PUBLISH-201, FR-VERSION-201, FR-RUNTIME-201 | 设计扩展点，但不把 MVP 做重。 |
