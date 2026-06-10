# ARTIFACT-ASSISTANT-CLOSURE-2026-06-10: 产物助手交付收口共享合同

> 本合同是 Trellis、Maestro/Ralph 和 Codex 对“产物助手”方向的共享事实接口。实现、测试、验收和执行报告都必须引用本文件。

---

## 1. 元信息

| 字段 | 内容 |
| --- | --- |
| TASK-ID | `ARTIFACT-ASSISTANT-CLOSURE-2026-06-10` |
| 优先级 | P0/P1 |
| 绑定 FR-ID | `FR-ORCH-001`, `FR-ARTIFACT-001`, `FR-RESULT-001`, `FR-ACTION-001`, `FR-PERM-001`, `FR-DOCS-201`, `FR-PUBLISH-201` |
| 来源 | `bytedance_init_prd.md`, `bytedance_init_video_txt.txt`, `research/prd.md`, `research/product/product-design.md`, `research/architecture/technical-design.md`, `research/decision-log.md` DEC-009 |
| 负责人角色 | Codex 控制流程和验收；Trellis 管实现规范；Maestro/Ralph 管大范围执行 |
| 状态 | active |

---

## 2. 背景与目标

用户确认：在架构师把任务分派给前端、后端、文档、PPT 等角色之后，交付链条必须由一个内置角色收口。该角色暂命名为 `产物助手`，职责是判断产物类型、创建 durable Artifact、生成 IM 内联预览/发布卡，并同步右侧 Artifacts 列表。

`产物助手` 不是右侧面板里的“新建产物”按钮，也不是 PPT 内容生成角色。它是产品交付链条中的收口角色。

---

## 3. 用户链路合同

1. 用户在 Web IM 中发起产品交付任务，例如“做一个生成姓名的网页，使用 sqlite 存储记录”。
2. 架构师生成计划并分派给后端、前端、文档、PPT 等实现角色。
3. 实现角色完成后，DAG 自动进入 `产物助手收口` 节点。
4. `产物助手` 读取实现输出、workspace 文件、`.agenthub/delivery.json`、`.agenthub/start.sh` 和 package scripts，判断产物类型。
5. `产物助手` 创建一个主 `final_product_candidate`，并可创建多个 `supporting_product_artifact`。
6. 聊天流中出现结果卡，内联展示 `change_summary`、`diff`、`artifact`、`web_preview` / `document_preview` / `presentation_preview`、`publish_status`。
7. 右侧 Artifacts 列表读取同一批 durable artifact records，展示启动、打开、停止、预览、下载、全屏和 source message/run 回链。
8. 非完全权限下，用户点击启动或继续后必须出现可交互权限卡；允许后继续执行，拒绝后不产生副作用。
9. `full_control` / `dangerous_bypass` 下，服务型主产物可自动启动，但必须写入自动通过审计卡和发布状态卡。

完成条件：刷新 Web/Mobile/Desktop 或通过 API 读回后，消息、计划、权限、产物、URL、端口、失败原因和停止状态仍一致。

---

## 4. 三端职责边界

| 端 | 职责 | 不做什么 |
| --- | --- | --- |
| Web | 主 IM、权限卡、结果卡、iframe/Markdown/PPT 预览、右侧 Artifacts 操作、启动/停止服务 | 不提供绕过聊天流的“新建富文档/新建演示稿”中心 |
| Mobile/PWA | 轻量查看消息、权限卡、产物预览、发布状态和失败原因 | 不做完整 IDE 文件管理，不启动本地 Runtime |
| Desktop/Electron | 本地 Connector、Runtime 监督、轻量读回；必要时使用已接受 fallback 验收 | 不复制完整 Web 工作台，不伪造 Web/Mobile 状态 |

---

## 5. 数据与后端合同

- `artifacts` 必须有 durable row；消息 metadata 不能作为唯一真相源。
- 一次产品交付只能有一个主 `final_product_candidate`。
- 同轮生成的 Markdown、PPTX、图片、静态文件等登记为 `supporting_product_artifact`。
- 服务型主产物启动命令优先来自 `.agenthub/delivery.json` + `.agenthub/start.sh`，其次来自 artifact metadata 的 `startCommand` 或 package script。
- `publish_status` 必须持久化状态、URL、端口、错误摘要和停止状态。
- 权限边界遵守 `runtime-gateway-permission-wait.md`：非完全权限必须 pending；完全权限自动通过但有审计卡。
- PPT 内容生成由 PPT 助手、演示稿工程师或 `ppt_master` 执行；产物助手只负责登记、预览转换、下载、发布控制和回链。

产品运行时是否允许 mock 主链路数据：**否**。

---

## 6. UI/UX 合同

- 产物结果必须优先进入聊天流内联卡，再同步右侧 Artifacts。
- 过程卡降噪，产物卡直接显示用户动作：启动、打开、停止、预览、下载、全屏。
- 权限卡必须是产品确认卡，而不是开发日志提示；展示动作、影响范围、风险、命令或路径、允许/拒绝。
- 右侧 Artifacts 是 read/operate surface，不显示冗余“新建”按钮。
- 没有选择联系人或群聊时，中栏为空白工作区，只显示“请选择联系人或者群聊”，不显示 composer、标题或消息背景。
- 对话式创建 Agent 应发生在正常聊天流或专门 `Agent 创建助手` 中，不放在右侧面板作为主要入口。

---

## 7. 测试与验收合同

自动化测试必须覆盖：

- Fresh full-control canonical product delivery：计划 completed、产物助手收口、artifact row、result card、服务启动/停止、Web/Mobile/Desktop readback。
- Fresh manual allow/reject：pending 权限卡出现，allow 续跑并产生副作用，reject 不产生副作用。
- 结果卡内容：`change_summary`、`diff`、`artifact`、`web_preview`、`publish_status` 均在聊天流读回。
- 服务型产物：点击启动、打开 URL、刷新后状态不丢、点击停止后进程关闭并持久化。
- 文档/PPT：Markdown/PPTX artifact 能在聊天卡和右侧列表预览、全屏、退出全屏；PPT 转 PDF 和 `ppt_master` 完整角色化属于 P2 验收项，不阻塞本合同。
- E2E harness：任何 `RUNTIME_EXECUTOR=script is only allowed for tests`、缺 worker、缺真实 runtime executor 的 preflight failure 均不能计入通过。

人工验收路径：

1. 标准权限发送 canonical prompt。
2. 确认权限卡可见并可点击。
3. 点击允许后观察流程继续到产物助手结果卡。
4. 点击启动，打开 URL，刷新页面，停止服务。
5. 在 Web/Mobile/Desktop 读回同一 session 的消息、权限、产物和发布状态。

---

## 8. 完成门禁

- [ ] `research/project-tracker.md`、`research/sequential-execution-progress.md`、`research/regression-ledger.md` 状态一致。
- [ ] 最新 fresh run 不能有 P0/P1 `failed`、`partial`、`blocked`、`not-run`。
- [ ] 历史 pass 只能作为线索；后续更新的 fresh fail marker 必须重新打开对应 blocker。
- [ ] 运行 `bash scripts/verify-governance-gate.sh ARTIFACT-ASSISTANT-CLOSURE-2026-06-10` 且 exit 0。
- [ ] 精确提交本合同和对应文档更新，不提交临时截图、缓存或未入账 UAT 目录。

---

## 9. 当前证据与风险

截至 2026-06-10，代码层已经有 `产物助手`、`final_product_candidate`、`supporting_product_artifact`、结果卡和发布状态基础能力。但本合同不能直接标记完成，因为工作区存在更新的未入账 fresh fail 证据：

- `STRICT-SPD-1781034360339-3a63e1`：strict product delivery `FAIL`，65 passed / 12 failed，`finalArtifactId=null`，计划仍 running；生成项目 `npm test` 失败，缺 `supertest`。
- `PERMISSION-BRANCH-1781034038005-a684c9`：manual permission preflight `FAIL`，原因是缺 real runtime executor / live runtime worker。
- `PERMISSION-BRANCH-1781034095538-b05c35`：manual permission `FAIL`，allow/reject 流程被对话式 Agent 草稿路径截走，未进入目标权限审批路径。

下一步必须修复上述 blocker，并重跑同一合同的 fresh full-control + manual allow/reject + 三端 readback。
