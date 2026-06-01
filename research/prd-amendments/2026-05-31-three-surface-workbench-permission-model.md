# 三端会话工作台与权限模型统一修订

**日期：** 2026-05-31  
**状态：** confirmed  
**触发任务：** `.trellis/tasks/05-31-three-surface-workbench-permission-model/`  
**共享合同：** `research/contracts/THREE-SURFACE-WORKBENCH-PERMISSION-001.md`  
**影响 FR-ID：** `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001`, `FR-CHAT-001`, `FR-PERM-001`, `FR-NOTIFY-001`, `FR-ACTION-001`, `FR-ARTIFACT-001`, `FR-RESULT-001`, `FR-UI-001`  
**相关文档：** `research/prd.md`, `research/product/product-design.md`, `research/product/ui-design-system.md`, `research/architecture/technical-design.md`

---

## 1. 触发原因

用户在评审 Desktop “批准/拒绝”功能时指出：如果 Desktop 和 Mobile 都提供待审批列表和批准/拒绝按钮，三端职责会重复；如果 Web/Mobile 已经完成授权，用户还要打开 Desktop 再确认本地执行，体验不可接受。

进一步讨论后确认：AgentHub 应参考成熟 Agent 工作台和 OpenAI Codex 的桌面/移动模式。Desktop 应是本机 Host 和策略执行环境，Web/Mobile 应承担统一授权入口和远程监督控制；Desktop 不应做审批中心或二次确认弹窗。

---

## 2. 当前契约

当前 PRD 和产品设计中存在以下表述：

- Desktop 可以查看待审批项。
- Desktop 轻量会话展示待审批动作。
- Mobile 提供轻量 IM、审批和预览。
- Web、Desktop、Mobile 都可以查看待审批队列。

现有 Desktop 实现也存在静态 approvals store 和 `批准/拒绝` 按钮，批准/拒绝只从本地列表删除，未绑定真实 Session、Run、Action、授权记录或后端策略。

---

## 3. 问题

1. **职责重复**：Desktop 和 Mobile 都做审批列表时，端侧差异只剩“处理不同类型的审批”，不是成熟产品分工。
2. **重复确认**：用户在 Web/Mobile 已授权后，如果 Desktop 再要求批准，会造成跨端来回切换。
3. **上下文不足**：孤立审批卡没有完整会话、执行域、命令、目录、diff、artifact、策略命中原因，用户无法判断风险。
4. **数据模型缺失**：审批、diff、artifact、执行日志如果不绑定 `sessionId/runId/messageId/workspaceId`，三端同步会变成各自维护状态。
5. **参考项目未落实**：现有文档提到 codeg/AionUi 等参考，但实现没有形成成熟会话壳、权限卡、Composer、Session sidebar、diff/artifact 面板和跨端监督模型。

---

## 4. 建议修订

### 4.1 三端职责

| 端 | 修订后职责 |
| --- | --- |
| Web | 完整 Session 工作台：会话、Run 卡、Composer、权限模式、授权卡、Context/Changes/Artifacts、Git diff、artifact、搜索 |
| Desktop | 本机 Host/控制台：本机策略预设、Runtime/CLI 状态、本机执行代理、执行日志、本机策略审计记录、策略镜像和本地校验 |
| Mobile/PWA | 远程监督控制端：查看 Session/Run/diff/artifact/测试结果、轻量输入、授权卡、权限模式查看和有限控制 |
| 后端 | 策略事实源、授权记录、审计、通知和三端状态同步 |

Desktop 不再作为审批中心，不展示孤立的“待审批”批准/拒绝队列，不弹二次确认。Desktop 可以记录某动作原本超出本机策略、由 Web/Mobile 授权后执行。

### 4.2 权限与授权语义

权限状态使用：

- `可执行`：已在策略范围内或已有有效授权。
- `需要授权`：超出当前策略但可由用户授权。
- `已取消`：用户未授权或取消。
- `安全阻断`：设备、签名、目录、策略版本或安全边界不成立。

常规超出策略不叫“拒绝执行”，而是回到 Web/Mobile 当前 Session 生成授权卡。只有安全边界不成立时才阻断。

### 4.3 权限预设

第一版至少支持：

| 预设 | 说明 |
| --- | --- |
| 沙箱模式 | 只读或受限执行，写入和高风险动作需要授权 |
| 标准模式 | 允许 workspace 内常规读写、测试、构建；删除、部署、越界、敏感命令需要授权 |
| 自动执行 | 允许本 Session 内常规动作自动继续；高风险仍需授权 |
| 完全控制 | 当前 workspace/device 范围内最大授权；必须有强提示、审计、撤销和安全阻断 |

Cloud Runtime 和 Desktop Runtime 可以有不同策略细节，但策略事实源统一在后端。Desktop 保留本地只读镜像和执行前校验。

### 4.4 工作台信息架构

Web/Desktop 采用同一套桌面级 Agent 工作台视觉语言；Mobile/PWA 做同模型降维。

Web 工作台结构：

- 左侧：Workspace/Session sidebar，支持标题搜索和内容搜索。
- 中间：消息流、Run 卡、权限卡、Composer。
- 右侧：`Context / Changes / Artifacts`。

右侧面板要求：

- `Context`：附件、引用文件、当前 workspace/session 上下文。
- `Changes`：Git diff、文件改动、执行关联。
- `Artifacts`：预览、报告、命令输出、测试结果、生成文档。

所有 Context/Changes/Artifacts 必须回链到 Message/Run；点击右侧条目定位对话，点击 Run 卡定位右侧条目。

### 4.5 参考项目复用策略

原则：参考项目优先，不从零设计；但最终以 AgentHub 数据模型和统一视觉系统重写落地。

| 参考对象 | 采用内容 |
| --- | --- |
| OpenAI Codex | Desktop Host、Mobile 远程监督、relay、diff/test/artifact/approval 跨端查看、沙箱/权限模式 |
| codeg | conversation shell、message input、permission dialog、sidebar、工具调用和工作台密度 |
| AionUi | ChatLayout、多面板会话、本地 Agent 卡、Runtime 状态和轻量桌面会话 |
| lobehub | Mobile 信息降维、会话和状态组织 |
| 成熟 diff/artifact 组件 | 文件列表、diff viewer、折叠、高亮、artifact/preview 面板 |

代码级复用必须先确认 license、依赖、样式系统、状态管理和数据模型适配。交互、信息架构、组件拆分和视觉密度可大胆参考。

### 4.6 明确不做

- 不做 Desktop 审批中心。
- 不做 Desktop 二次确认弹窗。
- 不让三端各自保存权限事实。
- 不把 Git diff 当作审批对象；diff 是执行证据。
- 不用 mock approval/diff/artifact/session 数据证明主链路。
- 不做批量 workspace 管理作为第一版目标。

---

## 5. 测试影响

需要新增或调整：

- Web E2E：Session 工作台、Composer、权限模式、授权卡、Run 卡、Context/Changes/Artifacts 双向定位、Git diff。
- Desktop E2E/集成：本机策略预设、Runtime 状态、执行日志、本机策略审计记录；确认不出现审批中心和二次确认。
- Mobile/PWA E2E：远程监督视图、Run 摘要、diff/artifact 摘要、授权卡。
- API/integration：策略事实源、授权记录、Run/Message/Diff/Artifact/Attachment 关联。
- 视觉断言：三端同一视觉语言，参考 codeg/AionUi 工作台密度，不再像三个不同产品。

---

## 6. 用户确认问题

无。用户已确认：

- Desktop 不做审批中心，改为本机策略、Runtime、执行日志和本机策略审计记录。
- Web/Mobile 统一做授权入口。
- Mobile 参考 Codex，定位为远程监督控制端，不只是审批页。
- Web/Desktop 可参考 codeg/AionUi 桌面工作台风格。
- 参考项目优先，不从零设计；最终按 AgentHub 数据模型和视觉系统重写。
- 第一版包含权限预设、Composer、附件入口、Session 切换、Git diff、artifact/结果面板、简单标题/内容搜索。

---

## 7. 合并记录

- confirmed：2026-05-31 用户在本轮讨论中确认。
- merged：待后续同步到 `research/prd.md`, `research/product/product-design.md`, `research/product/ui-design-system.md`。
