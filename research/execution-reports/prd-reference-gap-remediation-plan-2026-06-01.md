# PRD 参考项目缺口修复计划（2026-06-01）

## 目标

把当前 Web 工作台从“能发消息 + 基础右栏展示”推进到 PRD 要求的可验收协作工作台：三列可调布局、真实 Orchestrator、工具/权限/变更事件、文件预览/下载、artifact durable output、PWA 降维查看、Desktop 本地执行边界一致。

本计划以 Web 为主，Desktop/Mobile 覆盖到 P0 主链路一致性。实现阶段优先参考 `codeg`、`OpenCodeUI`、`AionUi`，能迁移交互模式就迁移，不重造低质量版本。

## 产物定义

Artifact 不能只等于“某条消息里的 metadata”。P0 应支持一个统一 durable artifact 模型：

| 来源 | 是否可成为产物 | 规则 |
| --- | --- | --- |
| Runtime 显式输出 | 是 | worker/adapter 产生 `artifact_created` 或 XML/JSON artifact block，落库并关联 source message/run |
| Workspace 文件 | 是 | 用户在文件树中对单个文件“标记为产物”，系统记录 file path、type、revision/hash、download/read URL |
| Workspace 文件夹 | 是 | 用户可将文件夹标记为产物集合，系统生成 manifest，列出子文件、大小、类型、入口文件；支持下载 zip |
| Git diff / patch | 是 | 作为 change artifact，关联 run 和 changed files，可预览 diff，可下载 patch |
| 普通聊天文本 | 默认否 | 只有用户显式保存或 runtime 标记时成为 artifact |
| 附件 | 可选 | 上传附件默认是 context；用户或 runtime 显式转存后才是 artifact |

P0 artifact 类型建议：

- `html`: HTML 预览，sandbox iframe，禁止直接执行同源敏感脚本。
- `markdown`: Markdown 预览。
- `code`: 代码/纯文本预览。
- `image`: 图片预览。
- `diff`: Git diff/patch 预览。
- `folder`: 文件夹 manifest + zip 下载。
- `generic_file`: 其他文件下载 + 基础 metadata。

## 阶段计划

### Phase 1: 工作台布局与文件/产物基座

目标：先把右栏和文件/产物能力做成真实基础设施，避免后续 Orchestrator 产出没有地方落。

实施项：

1. 右侧栏支持拖动宽度。
   - 参考：AionUi `ChatLayout` 的 workspace/preview split 和 collapse 约束。
   - 要求：min/max width、双击/按钮收起、重载保持、移动端隐藏或抽屉降级。
   - 验收：Web E2E 拖动右栏，断言中栏 composer 仍置底、三列独立滚动、刷新后宽度保持。

2. 文件树从只读列表升级为可打开文件。
   - 参考：codeg `aux-panel-file-tree-tab.tsx`、AionUi `Workspace`。
   - API：`GET /api/workspaces/:id/files/read?path=...`、`GET /api/workspaces/:id/files/download?path=...`。
   - 要求：owner 校验、路径越界防护、大小限制、二进制降级下载。
   - 验收：真实 cloud workspace 中创建 html/md/ts/plain 文件，UI 展开并打开预览。

3. HTML/Markdown/code/diff 预览。
   - 参考：AionUi `Preview/components/viewers/*`，ChatGPTNextWeb `markdown.tsx`。
   - 要求：HTML iframe sandbox；Markdown GFM；code 高亮；diff 增删行统计和折叠。
   - 验收：预览内容断言具体 DOM，而非只断言容器可见。

4. 下载和文件夹 zip。
   - API：文件下载、文件夹 manifest、文件夹 zip 下载。
   - 要求：大目录限制、明确错误态、下载按钮不可用原因。
   - 验收：下载接口返回正确 headers；文件夹 manifest 在 UI 可读。

5. Artifact durable API。
   - API：`POST /api/artifacts`、`GET /api/artifacts?session_id=...`、`GET /api/artifacts/:id`、`GET /api/artifacts/:id/download`。
   - DB：如果当前 schema 不足，新增 artifact 表；至少包含 `workspace_id/session_id/source_message_id/source_run_id/source_path/type/title/metadata/content_ref/created_by`。
   - 要求：artifact Tab 不再只扫 message metadata；message metadata 可以保留 source link。
   - 验收：从文件树标记文件/文件夹为产物，刷新后产物 Tab 仍可打开和下载。

### Phase 2: 消息模型、工具事件和权限闭环

目标：让中间消息流能表达真实 Agent 执行过程，而不是只有纯文本。

实施项：

1. 扩展 SSE/store message parts。
   - 参考：OpenCodeUI `MessageRenderer.tsx`、`ToolPartView.tsx`；codeg `content-parts-renderer.tsx`。
   - 事件：`runtime_output`、`tool_call_started`、`tool_delta`、`tool_result`、`permission_request`、`question`、`diff_created`、`artifact_created`、`runtime_completed`、`runtime_failed`。
   - 验收：unit 覆盖事件合并；E2E 覆盖 streaming、tool running、tool completed、tool error。

2. 消息流渲染 rich cards。
   - 计划卡、权限卡、工具卡、结果卡、diff 卡、artifact link。
   - 用户长消息折叠、agent markdown/code copy、消息 copy/pin/source link。
   - 验收：真实或 scripted real executor 产出结构事件，UI 逐步显示并 reload 后重建。

3. 权限预设接执行策略。
   - 当前 permissionMode 只存在 metadata，需要进入 runtime/action permission engine。
   - 超权动作生成 action + notification，Web/PWA 当前会话显示授权卡。
   - 批准后恢复原 run/action，取消后 run 明确终止。
   - 验收：提交需要写文件/命令的任务，先出现权限卡，批准后继续执行并生成文件变更。

### Phase 3: Orchestrator 真编排

目标：未 @、@多个角色、@Orchestrator 都进入真实 Orchestrated Flow。

实施项：

1. Orchestrator structured output。
   - 输出澄清问题、计划草案、节点、依赖、目标 Role Agent、预期 artifact、权限敏感动作。
   - 后端校验 DAG、role ownership、runtime/workspace execution domain。

2. 计划确认与节点调度。
   - `PlanCard` 在消息流和右栏都可见。
   - 确认后 ready nodes 进入 runtime queue；节点状态回写；失败可重试/跳过/停止。

3. Direct Role Flow 和升级。
   - 单 @ 直接给目标角色；角色可请求升级给 Orchestrator。
   - 多 @ 和无 @ 由 Orchestrator 决定是否追问、计划或直接回复。

验收：

- 无 @ 发送任务：出现 Orchestrator 澄清或计划。
- @ 前端 + @ 后端：生成分工计划，确认后两个节点分别执行/汇总。
- 单 @ 测试：不强制 Orchestrator，但可升级。
- 失败节点：UI 提供重试/跳过/停止，状态持久。

### Phase 4: Composer、会话列表和三端一致性

目标：把用户入口做成完整 IM，而不是调试输入框。

实施项：

1. Composer 升级。
   - 参考：codeg `message-input.tsx`、OpenCodeUI `InputBox.tsx`。
   - textarea/autoresize、inline @、slash command、附件/文件引用、stop/abort、草稿、输入历史。
   - 验收：真实键盘输入、粘贴多行、inline @ 多角色、上传附件、停止运行。

2. 会话列表升级。
   - `/api/sessions` 返回 last message、role participants、run status、pending action count。
   - UI 显示最近消息、运行中、待审批、失败。
   - 验收：发消息后列表更新，刷新后仍正确。

3. Mobile/PWA 降维 rich cards。
   - 会话内显示 plan/tool/action/artifact 摘要。
   - 审批后 Web 状态同步。
   - 预览页接 artifact API。

4. Desktop 本地链路对齐。
   - 本地轻量输入必须走后端 run/action 或明确降级为本机 scratch。
   - 真实 workspace folder binding。
   - 打开 Web 指向当前 workspace/session。

### Phase 5: 旧入口清理和验收门禁

目标：清掉造成假完成的旧代码、旧测试、旧文档。

实施项：

1. 删除或迁移旧 `apps/web/components/chat/ChatPanel.tsx`、`DetailPanel.tsx` 等未挂载旧语义组件。
2. 更新旧 E2E 的 `上下文` Tab 断言到 `角色 / 文件 / 变更 / 产物`。
3. 静态扫描：`page.route` 主链路 mock、`test.skip`、旧文案、旧 test id、`FakeExecutor`/scripted-only 成功口径。
4. 报告中分开列：
   - 自动实测通过。
   - opencli/browser 真实登录态通过。
   - Electron 通过。
   - RN/模拟器未验真。
   - 需要人工确认的隐私/登录步骤。

## 测试策略

最低真实测试矩阵：

| 层级 | 测试 | 必须断言 |
| --- | --- | --- |
| Unit | artifact type detection、path guard、message event reducer、permission policy | 输入输出结构、错误类型、越界拦截 |
| API | files read/download/zip、artifacts CRUD、git status/diff、plans/actions owner check | 403/404/413、owner workspace 校验、刷新重读 |
| Web E2E | workspace 创建、文件预览、右栏拖动、发送消息、tool/permission/diff/artifact、reload | 真实 DB/API/runtime，DOM 内容和数据源一致 |
| opencli UAT | 复用真实浏览器登录态和 Electron | 手动登录/敏感授权由用户处理，截图留存 |
| Desktop | runtime detect、workspace binding、DeviceChannel/local run | 不绕过后端权限；失败态中文明确 |
| Mobile/PWA | 390x844 视口会话、审批、artifact 预览 | 同一 session 状态同步 |

禁止项：

- 不用 mock 主链路 API 证明完成。
- 不把 skipped E2E 写进完成证明。
- 不用 message metadata JSON 代替 artifact viewer。
- 不用文件树列表代替文件预览/下载/产物闭环。
- 不把 Desktop 本地 activity 当成 Web/后端 Session 消息。

## 建议任务拆分

按工程风险建议拆 7 个任务，顺序执行：

1. `web-workbench-layout-files-artifacts`：右栏拖动、文件 read/download/preview、artifact API。
2. `web-message-event-model`：SSE parts、tool/permission/diff/artifact events、message renderer。
3. `web-orchestrator-flow`：结构计划、确认、节点调度、失败恢复。
4. `web-composer-session-list`：textarea、inline @、slash、stop、last message/status。
5. `mobile-pwa-rich-supervision`：plan/action/artifact 移动降维和预览。
6. `desktop-local-workspace-run-alignment`：folder binding、本地轻量输入后端化、Web deep link。
7. `acceptance-governance-cleanup`：旧组件/旧测试清理、真实 UAT 矩阵和报告。

每个任务都必须先写 PRD 反查矩阵，再实现，再跑测试后反查，最后更新 tracker/ledger/report。
