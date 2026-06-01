# THREE-SURFACE-WORKBENCH-PERMISSION-001: 三端会话工作台与权限模型统一共享合同

> 本合同是 Trellis 与 Maestro/Ralph 的共享事实接口。实现、测试、验收和执行报告都必须引用本文件。

---

## 1. 元信息

| 字段 | 内容 |
| --- | --- |
| TASK-ID | `THREE-SURFACE-WORKBENCH-PERMISSION-001` |
| 优先级 | P0 |
| 绑定 FR-ID | `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001`, `FR-CHAT-001`, `FR-PERM-001`, `FR-NOTIFY-001`, `FR-ACTION-001`, `FR-ARTIFACT-001`, `FR-RESULT-001`, `FR-UI-001` |
| 来源 | `research/prd.md`, `research/product/product-design.md`, `research/product/ui-design-system.md`, `research/architecture/technical-design.md`, `research/prd-amendments/2026-05-31-three-surface-workbench-permission-model.md` |
| 负责人角色 | Codex 控制流程；Trellis 管实现规范；Maestro/Ralph 管大范围执行 |
| 状态 | active |

---

## 2. 背景与目标

现有产品合同和实现把 Web、Desktop、Mobile/PWA 都描述成可查看或处理待审批项，Desktop 中甚至存在本地静态审批列表和“批准/拒绝”按钮。这会让三端职责重复，且用户在 Web/Mobile 已经授权后还可能被迫打开 Desktop 二次确认。

本任务将三端模型收敛为同一套成熟 Agent 工作台：

- Web 是完整 Session 工作台。
- Mobile/PWA 是远程监督控制端。
- Desktop 是本机 Host、策略、Runtime 和执行日志端。
- 后端是策略、授权、审计和状态同步的事实源。

目标不是重写一个独立审批页，而是把 Session、Run、权限模式、授权卡、Git diff、Context、Artifacts、执行日志和搜索纳入同一条用户链路。

---

## 3. 用户链路合同

1. 用户在 Web、Desktop 或 Mobile/PWA 登录同一账号。
2. 用户进入某个 Workspace 和 Session。
3. 用户通过统一 Composer 发送任务，可附加文件、图片或上下文引用，并选择权限预设。
4. Agent 运行生成一条或多条 Run 记录，Run 记录绑定 `sessionId`、`messageId`、`workspaceId`、`executionDomain`。
5. 如果动作在当前策略内，Cloud Runtime 或 Desktop Runtime 执行并回传状态。
6. 如果动作超出当前策略但可授权，Web/Mobile 当前 Session 显示授权卡；用户可选择仅本次允许、本 Session 允许、调整策略或取消。
7. Desktop 不弹二次确认，不提供审批中心；它只同步本机策略、执行已授权请求、记录越权授权和执行结果。
8. Web 右侧 `Context / Changes / Artifacts` 面板展示附件、引用、Git diff、结果、预览、测试报告等结构化证据。
9. 用户点击右侧任一条 Context、Change、Artifact 或日志记录，中间对话定位到对应 Message/Run；点击对话里的 Run 卡，右侧定位到对应条目。
10. Mobile/PWA 可远程查看线程、Run、diff、artifact、测试结果和授权卡，但不持有本地文件、凭证或 Runtime。

完成条件：用户能在同一 Session 中完成“输入任务 → 附加上下文 → 选择权限模式 → Agent 执行 → 需要时授权 → 查看 diff/artifact/log → 继续追问”的闭环，且 Web/Desktop/Mobile 看到的是同一套状态语义。

---

## 4. 三端职责边界

| 端 | 职责 | 不做什么 |
| --- | --- | --- |
| Web | 完整 Session 工作台；Session 列表/切换；Composer；权限模式；授权卡；Run 卡；`Context / Changes / Artifacts`；Git diff；artifact/结果面板；标题和内容搜索 | 不直连本机端口；不保存本地 CLI 凭证；不把 Desktop 状态 mock 成在线 |
| Desktop | 本机 Host/控制台；本机权限预设；Runtime/CLI 检测；本机执行代理；执行日志；本机策略审计记录；策略镜像和本地校验；当前本机会话运行态 | 不做审批中心；不弹二次确认；不复制完整 Web 工作台；不保存本地 Claude/Codex API Key/Base URL |
| Mobile/PWA | 远程监督控制端；查看 Session/Run/diff/artifact/测试结果；轻量输入；授权卡；权限模式查看和有限切换 | 不接入本地 Runtime；不选择本地目录；不做完整 IDE 文件管理；不持有本机凭证 |
| 后端 | 策略事实源；授权记录；审计；通知和状态广播；三端一致性 | 不用 mock 主链路状态证明完成 |
| Cloud/Desktop Runtime | 各自执行域内执行动作并回传结果、日志、diff、artifact | 不绕过后端策略和授权记录 |

---

## 5. 数据与后端合同

必须统一以下对象关系：

| 对象 | 必备关联 |
| --- | --- |
| Message | `sessionId`, `workspaceId` |
| Run/Execution | `sessionId`, `triggerMessageId`, `workspaceId`, `runtime`, `executionDomain`, `status` |
| PermissionRequest | `sessionId`, `runId`, `messageId`, `policyVersion`, `scope`, `expiresAt` |
| AuthorizationGrant | `permissionRequestId`, `approvedBy`, `approvedFromSurface`, `scope`, `expiresAt`, `policyVersion` |
| Diff/ChangeSet | `sessionId`, `runId`, `messageId`, `files[]` |
| Artifact | `sessionId`, `runId`, `messageId`, `type`, `source` |
| Attachment/ContextRef | `sessionId`, `messageId`, `workspaceId`, `source` |

权限状态命名：

- `executable`：已授权，可执行。
- `needs_authorization`：未授权但可请求用户授权。
- `cancelled`：用户取消或未授权。
- `security_blocked`：设备、签名、目录、策略版本或安全边界不成立。

产品运行时是否允许 mock 主链路数据：**否**。

---

## 6. UI/UX 合同

### 6.1 工作台信息架构

Web/Desktop 共享桌面级 Agent 工作台视觉语言，参考 codeg/AionUi 的会话壳、侧栏、工具调用卡、权限卡、输入框和多面板布局；Mobile/PWA 使用同一视觉 token 和组件语义做远程监督降维。

Web 默认结构：

- 左侧：Workspace/Session 列表，标题搜索和内容搜索入口。
- 中间：消息流、Run 卡、权限卡、Composer。
- 右侧：`Context / Changes / Artifacts`。

Desktop 默认结构：

- 本机策略和权限预设。
- Runtime/CLI 状态。
- 本机执行日志和本机策略审计记录。
- 当前本机会话运行态和轻量输入。

Mobile/PWA 默认结构：

- Session 列表和搜索。
- 轻量消息流。
- Run 摘要、diff 摘要、artifact 摘要。
- 授权卡和轻量输入。

### 6.2 权限预设

第一版至少支持：

- 沙箱模式：只读或受限执行，写入和高风险动作需要授权。
- 标准模式：允许 workspace 内常规读写、测试、构建；删除、部署、越界、敏感命令需要授权。
- 自动执行：允许本 Session 内常规动作自动继续；高风险仍需授权。
- 完全控制：当前 workspace/device 范围内最大授权；必须有强提示、审计、撤销和安全阻断。

权限预设必须明确绑定执行域：Cloud 策略和 Desktop 本机策略可不同，但事实源统一在后端。Desktop 可以维护本地只读镜像和执行前校验。

### 6.3 Run 卡与右侧面板联动

- Run 卡是权限、命令、diff、artifact、日志的父级 UI。
- 点击 Run 卡时，右侧面板定位到该 Run 的 Changes/Artifacts/Logs。
- 点击右侧 diff/artifact/context/log 时，中间对话定位并高亮对应 Message/Run。
- 所有右侧内容必须能回答：谁触发、Agent 做了什么、用户现在能继续追问/授权/查看什么。

---

## 7. 参考项目输入

参考项目优先，不从零设计；最终以 AgentHub 数据模型和统一视觉系统重写落地。

| 参考项目 | 读取范围 | 提炼内容 | 不采用内容 |
| --- | --- | --- | --- |
| OpenAI Codex | Codex desktop/mobile/relay/permission model 官方资料 | Desktop Host、Mobile 远程监督、relay、diff/test/artifact/approval 跨端查看、沙箱和权限模式 | 不复制专有实现；不把 AgentHub Desktop 变成 Codex 单 Runtime |
| codeg | `conversation-shell`, `message-input`, `permission-dialog`, `sidebar`, diff/artifact 相关组件 | 会话壳、权限卡、Composer、Session sidebar、工具调用和工作台密度 | 不复制无关 Provider/API Key 流程；不直接引入不兼容依赖 |
| AionUi | `ChatLayout`, `LocalAgents`, `AgentCard`, 桌面会话结构 | 多面板会话布局、本地 Agent 卡、Runtime 状态和进入会话动作 | 不采用 Arco 默认皮肤；不复制完整桌面 IDE 业务 |
| lobehub | 移动会话、设置分组、状态表达 | Mobile/PWA 远程监督端的信息降维 | 不引入模型供应商配置作为 P0 主流程 |
| 成熟 diff/artifact 组件 | Monaco Diff、react-diff-view、diff2html 或参考项目现有实现 | 文件列表、增删行、高亮、折叠、摘要和预览 | 不手写低质量 diff 渲染 |

组件迁移清单必须明确记录“参考组件 → AgentHub 目标组件 → 是否代码级复用 → license/依赖结论”。

---

## 8. Trellis 派生要求

- `.trellis/tasks/05-31-three-surface-workbench-permission-model/prd.md` 必须引用本合同和 PRD amendment。
- `implement.jsonl` / `check.jsonl` 必须包含本合同、PRD amendment、UI 设计系统、产品设计、相关 spec。
- 若后续实现发现可复用工程规则，更新 `.trellis/spec/frontend/*` 和 `.trellis/spec/cross-layer/*`。

---

## 9. Maestro/Ralph 派生要求

- 推荐按合同拆为：参考迁移清单、数据模型/API、共享 UI 组件、Web 工作台、Desktop Host 控制台、Mobile 远程监督、E2E/视觉门禁。
- 每个阶段必须更新执行报告和 tracker。
- 不允许只用静态 mock 组件证明完成。
- 不允许把 Desktop 待审批页作为完成项；Desktop 必须移除审批中心语义。

---

## 10. 测试与验收合同

自动化测试必须覆盖：

- API/integration：策略事实源、授权记录、Run/Message/Diff/Artifact 关联。
- Web E2E：发送任务、选择权限模式、出现授权卡、查看 diff/artifact、双向定位。
- Desktop E2E/集成：同步策略、本机权限预设、Runtime 状态、执行日志、本机策略审计记录；不出现审批中心和二次确认。
- Mobile/PWA E2E：查看 Session/Run/diff/artifact 摘要、授权卡、轻量输入。
- 视觉/布局断言：三端同一视觉语言，文本不溢出，右侧面板和 Run 卡联动可见。

人工验收路径：

1. Web 创建或打开一个 Session，发送含附件/上下文的任务。
2. 选择权限预设，触发 Cloud 或 Desktop 执行。
3. 超权时在 Web/Mobile 当前会话授权。
4. Desktop 执行并回传日志，不弹二次确认。
5. Web/Mobile 查看 diff、artifact、测试结果，点击可回链到对应 Run。

---

## 11. 计划阶段禁止项

- 把 Desktop 做成待审批中心。
- 在 Desktop 弹二次批准/拒绝确认。
- 让 Web、Desktop、Mobile 各自维护权限状态。
- 只写“参考 codeg/AionUi”但没有组件迁移清单。
- 用 hardcoded approval、diff、artifact 或 session 数据证明真实闭环。
- 用文件浏览器替代 Session/Run/Context/Changes/Artifacts 结构。

---

## 12. 验真样本

| 样本 | 只给执行者的合同描述 | 不应预置的答案 | 通过标准 |
| --- | --- | --- | --- |
| Desktop 审批重复样本 | 用户在 Web/Mobile 已授权本地执行后，不应被迫打开 Desktop 再点批准/拒绝 | 不直接说“删除 DesktopApprovalsPage”作为唯一修复 | 执行系统自行发现 Desktop 审批中心语义与合同冲突，并改为策略/日志/本机策略审计记录 |
| 右侧面板孤岛样本 | diff/artifact/context 必须回链 Message/Run | 不预置具体组件名 | 点击右侧条目能定位到对应对话记录，点击 Run 卡能定位右侧条目 |

---

## 13. 完成门禁

完成前必须满足：

- [ ] PRD amendment 已 confirmed，并同步到相关产品/UI 合同。
- [ ] 参考组件迁移清单已产出。
- [ ] `research/project-tracker.md` 已更新。
- [ ] 相关 execution report 已补齐。
- [ ] type-check、E2E、视觉断言按阶段通过。
- [ ] `bash scripts/verify-governance-gate.sh THREE-SURFACE-WORKBENCH-PERMISSION-001` exit 0。
- [ ] Codex 按本合同完成独立验收。

---

## 14. 残留风险与后续

- 完全控制模式必须有强提示、撤销、审计和安全阻断，不能默认开启。
- 代码级复用参考组件前必须确认 license、依赖、样式系统和状态管理适配。
- 文件树可以参考成熟组件，但第一目标仍是 Context/Changes/Artifacts 的 Session 证据区。
