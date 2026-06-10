# 模块调研：IM 底座、实时通信与富消息

**日期：** 2026-05-21  
**状态：** Draft  
**覆盖 FR-ID：** `FR-WEB-001`, `FR-MOB-001`, `FR-CHAT-001`, `FR-ARTIFACT-001`, `FR-RESULT-001`, `FR-NOTIFY-001`  
**相关产品设计：** `research/product/product-design.md` 第 4、6、8、9 章

---

## 1. 调研问题

AgentHub 的核心体验是 IM 式 Session。P0 需要消息流、Role Agent 流式回复、任务状态、富内容卡片、站内审批队列和三端同步。本模块需要回答：

1. 实时通信用 database-backed realtime、Socket.IO、SSE，还是纯轮询？
2. 消息模型如何承载 Markdown、代码块、Diff、Action 状态、Task Result Card？
3. Web 和 Mobile 如何共享轻量 IM 体验？

---

## 2. 实时通信候选方案

| 方案 | 优点 | 风险 | 适配度 |
| --- | --- | --- | --- |
| database-backed realtime | 与 Postgres/Auth 集成；可监听表变更、广播、presence | 复杂流式 token 事件可能需要额外表或 channel 设计 | 高 |
| Socket.IO | 双向实时成熟，适合复杂事件 | 需要自建长连接服务和鉴权 | 高 |
| SSE | 简单，适合服务端到客户端流式事件 | 不适合 Desktop 双向控制；移动和断线恢复需补逻辑 | 中 |
| 轮询 | 实现最简单 | IM 体验差，流式和审批延迟明显 | 低 |

**推荐：** P0 使用 database-backed realtime 承载消息/审批/状态同步；Runtime 流式输出可以先聚合为 message chunks 或事件表更新。

若后续发现 Desktop 控制通道需要更强双向能力，再引入专门 WebSocket gateway。

---

## 3. 消息与产物模型建议

### 3.1 Message

```typescript
type MessageKind =
  | 'user_text'
  | 'agent_text'
  | 'orchestrator_question'
  | 'system_status'
  | 'artifact_card'
  | 'action_card'
  | 'task_result_card';

type MessageStatus =
  | 'pending'
  | 'streaming'
  | 'completed'
  | 'failed'
  | 'requires_confirmation';
```

### 3.2 Artifact

```typescript
type ArtifactKind =
  | 'markdown'
  | 'code_block'
  | 'image'
  | 'file_ref'
  | 'web_preview'
  | 'diff'
  | 'action_status'
  | 'document_preview'
  | 'presentation_preview'
  | 'publish_status';
```

核心原则：

- Markdown 渲染和代码块复制是 P0。
- Diff 是 Artifact，不是审批对象。
- 执行输出只有在 Runtime/Action 真执行命令、测试、构建、预览、部署时进入 Task Result Card。
- AI 对话仍是普通消息，不复制成日志。
- 产品交付类结果由内置 `产物助手` 收口：创建一个主 `final_product_candidate`，并可创建多个 `supporting_product_artifact`。聊天内联卡和右侧 Artifacts 面板必须读取同一批 durable records。
- 富消息卡片使用 `RuntimeMessagePart` 类型判别，不通过解析自然语言判断是否是 Diff、网页预览、文档、PPT 或发布状态。
- 右侧 Artifacts 面板是读取/操作面，不提供绕过聊天流的新建富文档或新建演示稿入口。

对应需求：`FR-ARTIFACT-001`, `FR-RESULT-001`, `FR-PERM-001`。

---

## 4. 推荐路线

P0 推荐：

- 数据源：Postgres 表存储 Workspace、Session、Message、Artifact、Action、PendingApproval。
- 实时：database-backed realtime 监听 Session 消息和待审批项。
- 流式：先实现事件分片写入或消息内容增量更新；Web/Mobile 订阅更新。
- 富消息渲染：前端统一 `MessageRenderer`，按 `MessageKind` 和 `ArtifactKind` 分派组件。
- Markdown：使用成熟 Markdown 渲染库，代码高亮和复制封装成基础组件。
- 服务型主产物：展示启动、打开、停止、URL、端口、失败原因和刷新读回状态；非完全权限由用户触发启动，完全权限可自动启动但必须显示审计记录。
- 文档/PPT/图片等辅助产物：展示预览、全屏、下载和 source message/run 回链，不展示发布按钮，除非 manifest 明确声明启动命令。

---

## 5. 参考项目校准

参考 `research/modules/reference-projects.md`：

- codeg `Transport` 和 `EventStream` 设计强调 reconnect、ready handshake、snapshot/replay，说明实时消息不能只依赖「连接在线时收到事件」。
- Poco-Claw 通过 Backend 持久化 session/message/artifact/callback，Frontend 查询状态，说明消息和执行状态必须以数据库为真相源。

这些参考支持当前结论：database-backed realtime 可以作为 P0 同步通道，但 Message、Artifact、Action、PendingApproval 必须持久化，断线后通过查询补齐状态。

---

## 6. 待用户确认

**推荐确认项：**

A. P0 使用 database-backed realtime 作为 IM/审批同步底座。
B. P0 自建 Socket.IO gateway，控制更强但工程量更大。  
C. P0 先轮询，降低初期复杂度但牺牲体验。

我的建议是 **A**。它和 Auth/DB 组合最省实现成本，体验也足够。

---

## 7. 参考资料

- database-backed realtime 文档：Postgres + WebSocket/事件表实现
- Socket.IO 文档：https://socket.io/docs/v4/
- MDN Server-Sent Events：https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
