# ACCEPTANCE-REAL-FLOW-2026-06-01: 验收真实闭环合同

> 本合同覆盖验收前最后一轮真实链路硬化。旧任务或 status 显示 completed 不能作为完成证据；完成只看真实用户入口、真实 DB/API/session/runtime、可复现 E2E/UAT 和最终 artifact。

---

## 1. 元信息

| 字段 | 内容 |
| --- | --- |
| TASK-ID | `ACCEPTANCE-REAL-FLOW-2026-06-01` |
| 优先级 | P0 |
| 绑定 FR-ID | FR-AUTH-001, FR-WS-001, FR-CHAT-001, FR-AGENT-001, FR-RUNTIME-001, FR-DESK-001, FR-MOB-001, FR-ARTIFACT-001, FR-PERM-001 |
| 来源 | `research/prd.md`, `research/product-design.md`, `research/technical-design.md`, `research/contracts/ACCEPTANCE-HARDENING-2026-06-01.md`, 用户 2026-06-01 验收反馈 |
| Trellis 总任务 | `.trellis/tasks/06-01-acceptance-real-flow-program` |
| 状态 | active |

---

## 2. 背景与目标

当前项目已有多份完成报告，但实际代码仍存在验收不可接受的风险：`runtime-worker` 默认 `FakeExecutor`，本地 Desktop DeviceChannel 只建立连接和检测，`user_local` 分支尚未把 Web `/api/chat` 请求转发到 Desktop `runtime_invoke` 并回流输出；Web 附件只把文件名拼进 prompt；artifact 面板只展示消息 metadata，缺少 durable artifact 产出契约；部分 E2E 仍依赖 `test.skip` 或 `ScriptedRealExecutor` 作为替代证据。

本轮目标不是再做“可演示 MVP”，而是把核心 `@角色 -> runtime -> 回复 -> artifact` 主链路在本地链路和远程链路分别跑通。无法由当前环境自动完成的登录或授权环节，必须用 opencli 复用浏览器/Electron 状态并在人机边界处停下让用户处理，不能绕过。

---

## 3. 用户链路合同

1. 用户通过 opencli 或真实浏览器进入 Web，复用现有 GitHub 登录状态；若未登录，停在 GitHub/授权页由用户手工完成。
2. 用户创建或进入 Workspace，选择可 `@` 的内置角色。
3. 用户发送包含 `@角色`、权限预设、可选附件/上下文的消息。
4. `cloud` 工作区必须经 Gateway 入队到真实 worker；worker 使用真实 CLI/真实可配置 executor，不能默认 fake echo。
5. `local_desktop` 工作区必须经 Gateway DeviceChannel 转发到 Electron Desktop，本机执行 Codex/Claude Code CLI 或明确返回 CLI 未安装/未登录/不可启动。
6. runtime 输出以 SSE/DeviceChannel 事件回流，用户可见 agent 回复落库；刷新后仍可见。
7. 如 runtime 生成 artifact，系统写入 durable artifact 记录或 artifact metadata，右侧 Artifact 面板可查看，后续自动部署可消费该产物。

---

## 4. 三端职责边界

| 端 | 职责 | 不做什么 |
| --- | --- | --- |
| Web | 主工作台、Workspace/Session/Message、@角色、附件入口、Artifact、Gateway SSE | 不直接连本机 localhost/IP；不用 mock `/api/chat` 证明成功 |
| Desktop | 本地 CLI 检测、认证状态、DeviceChannel、`runtime_invoke` 执行、Electron UAT | 不假设能读取外部浏览器 OAuth cookie；不把按钮做成无效果占位 |
| Mobile/PWA | 查看会话、轻量发送、审批/预览主链路复用 Web API | 本轮不强依赖 Android Studio 模拟器；原生模拟器验收可由用户手工补充 |

---

## 5. 数据与后端合同

- 数据库：必须使用真实 `workspaces`, `sessions`, `messages`, `role_agents`, `runtime_endpoints`, `runtime_sessions`, `runtime_logs`, `device_runtime_channels`, `runtime_capabilities`。
- 新 artifact 能力如需表结构，优先复用现有 messages metadata；若不足，新增 migration/类型/API 一起补齐。
- 认证：E2E 可使用测试 auth storage state 或现有浏览器登录态，但必须验证真实权限边界。
- Runtime：`public_cloud` 和 `user_local` 都走 Gateway。`user_local` 必须实现 request/response/event 路由，不允许只发 `tunnel_ready` 就结束。
- 产品运行时是否允许 mock 主链路数据：**否**。`FakeExecutor` 只能用于单元/回归测试；验收主链路禁止以它作为成功证据。

---

## 6. opencli 验真策略

- 参考 `$write-help-doc`：使用 `opencli browser <session> state/find/eval/screenshot` 获取 DOM、截图和 CSS 坐标。
- Web 登录优先使用 opencli Chrome profile/session 复用 GitHub 登录态；出现凭证、授权、2FA、敏感信息页面时暂停，让用户处理。
- Electron 层优先用 opencli app adapter 或 Playwright Electron 控制真实窗口；`DESKTOP_APP_PATH` 表示已构建 Electron main 入口或 app bundle 路径，只是自动化启动目标，不代表产品功能。
- Web/Mobile/PWA 可用 opencli 浏览器视口测试；本轮不把 Android Studio 模拟器作为阻塞前置，除非用户要原生 RN GUI 截图。

---

## 7. 参考项目输入

| 参考项目 | 读取范围 | 提炼内容 | 不采用内容 |
| --- | --- | --- | --- |
| `refer_proj/AionUi` | agent team flow、remote agent、desktop settings、conversation layout | 多角色/Team Mode 状态机、远程 agent 配置、会话事件呈现 | 不复制 GPUI/Electron 皮肤 |
| `refer_proj/codeg` / `xintaofei__codeg` | transport 抽象、Web/desktop/remote 通道 | 统一 Transport 屏蔽 desktop invoke、HTTP、WebSocket | 不迁移 Tauri 架构 |
| `refer_proj/lobehub` | device gateway、heterogeneous agent、builtin tools/artifacts | Device Gateway auth/heartbeat/reconnect、Claude/Codex 会话元数据、artifact/tool event | 不引入完整 Lobe 平台 |
| `refer_proj/clawwork-ai__ClawWork` | shared gateway protocol、artifact/session | shared 协议、artifact durable output、PWA/Desktop 分层 | 不整体替换现有代码 |

---

## 8. Trellis 派生任务

1. `.trellis/tasks/06-01-acceptance-opencli-browser-electron`: 建立项目内 opencli UAT skill 和 Web/Electron 登录态复用测试方法。
2. `.trellis/tasks/06-01-acceptance-runtime-worker-core`: 改 runtime worker 默认和配置，使验收能明确选择真实 executor；保留 fake 仅测试。
3. `.trellis/tasks/06-01-acceptance-at-local-flow`: Web `local_desktop` `/api/chat` 经 DeviceChannel 到 Desktop `runtime_invoke` 并回流落库。
4. `.trellis/tasks/06-01-acceptance-at-remote-flow`: Web/Mobile `cloud` `/api/chat` 经真实 worker 跑通，非 echo 回复，失败态明确。
5. `.trellis/tasks/06-01-acceptance-attachments-artifacts`: 附件上传/上下文引用与 artifact durable output。
6. `.trellis/tasks/06-01-acceptance-real-e2e-uat`: 最终 E2E/UAT、截图、治理、tracker、ledger、commit。

---

## 9. 测试与验收合同

自动化必须覆盖：

- `pnpm type-check`, `pnpm lint`, `pnpm test` 不得假跳过核心断言。
- Web API/integration：`/api/chat` 对 `cloud` 与 `local_desktop` 分支分别验证 runtime_sessions/logs/messages。
- Desktop：DeviceChannel 收到 `runtime_invoke` 后执行真实 IPC/CLI 或明确诊断失败；Electron window 可被自动化打开。
- E2E：opencli/Playwright 真实入口，从登录态、workspace、@角色、发送、回复、刷新、artifact 面板完整走一遍。
- artifact：产物必须可被 DB/API/文件系统重新读取，不只是消息里一段文本。

人工验收路径：

1. 用户确认 GitHub 登录/授权或 Desktop CLI 登录状态。
2. Codex 使用 opencli/Playwright 启动 Web 和 Electron。
3. 本地链路与远程链路各发送一次 `@角色` 请求。
4. 页面展示回复、runtime 日志、artifact；刷新后仍存在。

---

## 10. 禁止项

- 用 `FakeExecutor`, `ScriptedRealExecutor`, hardcoded SSE 或 prompt echo 冒充验收成功。
- 用 `page.route` mock 主链路 API 作为 P0 通过证据。
- 用 `test.skip`、`playwright --list`、grep、截图存在证明功能完成。
- 把 `.workflow/.maestro/*/status.json completed` 当完成。
- 将附件降级为“只发送文件名”。
- Desktop 外部登录只打开浏览器，不证明身份/设备绑定/CLI 认证状态。

---

## 11. 当前已发现的真实缺口

| 缺口 | 代码证据 | 验收影响 |
| --- | --- | --- |
| worker 默认 fake | `apps/web/server/runtime-worker.ts` 默认 `new FakeExecutor()` | 默认环境容易把 echo 当成功 |
| local_desktop 未执行 | `apps/web/lib/runtime/gateway.ts` user_local 只 emit `tunnel_ready` | Web 本地链路没有回复/产物 |
| Desktop request 事件未路由回 Web runtime session | `apps/web/server/ws-gateway.ts` response 分支为空、event 只处理 detection | Desktop 执行结果无法转 SSE/落库 |
| 附件是假上传 | `apps/web/components/workspace/ChatPanel.tsx` 只保存 file.name 并拼 prompt | 用户上传内容不可用 |
| artifact 不 durable | ArtifactPanel 只从 messages/metadata 派生 | 后续自动部署缺少稳定产物接口 |
| E2E 仍有 deferred | 多个 spec `test.skip` 依赖外部 DB/auth/app path | 验收需补真实环境脚本或 opencli 人机边界 |

---

## 12. 完成门禁

- [ ] `research/project-tracker.md` 和 `research/regression-ledger.md` 同步真实状态。
- [ ] 每个子任务有 PRD、context、验证命令和结果。
- [ ] opencli UAT skill 可复用，包含登录/隐私边界。
- [ ] 本地链路、远程链路各自跑通核心 `@` 流程。
- [ ] artifact 产出可被重新读取。
- [ ] `bash scripts/verify-governance-gate.sh ACCEPTANCE-REAL-FLOW-2026-06-01` exit 0。
