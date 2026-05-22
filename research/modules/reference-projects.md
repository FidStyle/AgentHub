# 模块调研：参考项目架构依据

**日期：** 2026-05-21  
**状态：** Draft  
**覆盖 FR-ID：** `FR-DEVICE-001`, `FR-DESK-001`, `FR-RUNTIME-001`, `FR-ACTION-001`, `FR-ORCH-001`, `FR-CTX-001`, `FR-ARTIFACT-001`

---

## 1. 调研目的

Phase 2 技术选型不能只依赖官方资料。`refer_proj/` 中已有多个和 AgentHub 接近的参考项目，分别覆盖：

- 桌面端本地文件、Shell、CLI Agent 能力。
- Web/Desktop 传输抽象。
- Device Gateway / 远程设备 WebSocket。
- Agent Runtime、Orchestrator、Team Mode、ACP 状态机。
- 多服务 agent 执行平台。

本文记录对 AgentHub 技术路线有直接影响的参考依据。

---

## 2. 参考项目摘要

| 项目 | 相关点 | 对 AgentHub 的启发 |
| --- | --- | --- |
| `refer_proj/lobehub` | Next.js + Electron Desktop + `apps/device-gateway` + `packages/agent-runtime` + `packages/device-gateway-client` | 支持 Web/Desktop 分端、device gateway、Electron 本地工具执行、Claude/Codex heterogeneous agent 接入 |
| `refer_proj/codeg` | Tauri 2 + Next.js static export + Axum HTTP/WebSocket + `lib/transport` 抽象 | 证明 Transport 抽象可同时适配 desktop invoke、web fetch/WebSocket、remote desktop |
| `refer_proj/AionUi` | Electron 多进程、ACP rewrite、team mode、remote agent 设计 | Orchestrator/Team Mode 应使用明确状态机和单队列，不要让隐式状态扩散 |
| `refer_proj/poco-claw` | Next.js + FastAPI backend/executor/executor-manager + callback/polling 模型 | 展示多服务 agent 执行平台的清晰分层，但对 AgentHub P0 来说偏重 |
| `refer_proj/cherry-studio` | Electron main/renderer/preload、shared package、AI Core/provider abstraction、MCP 管理 | 证明 Electron + shared package + typed IPC 是成熟桌面 AI 应用路线 |

---

## 3. LobeHub 关键参考

### 3.1 Device Gateway

相关文件：

- `refer_proj/lobehub/packages/device-gateway-client/src/client.ts`
- `refer_proj/lobehub/packages/device-gateway-client/src/types.ts`
- `refer_proj/lobehub/apps/desktop/src/main/controllers/GatewayConnectionCtr.ts`

关键发现：

- Device gateway client 使用 WebSocket 主动连接云端。
- 连接包含状态：`connecting`、`authenticating`、`connected`、`reconnecting`、`disconnected`。
- WebSocket 首包发送 auth，后续有 heartbeat、reconnect、missed heartbeat 处理。
- 协议消息包括：
  - `tool_call_request` / `tool_call_response`
  - `system_info_request` / `system_info_response`
  - `agent_run_request` / `agent_run_ack`
- `agent_run_request` 已包含 `agentType: 'claude-code' | 'codex'`、`cwd`、`prompt`、`resumeSessionId`。

对 AgentHub 的影响：

- P0 应直接使用 WebSocket 作为 Desktop Connector 的设备通道主实现。
- `DeviceChannel` 应是接口抽象，不是轮询替代方案。
- AgentHub 的 DeviceChannel 协议应至少包含 auth、heartbeat、action request/response、agent run request/ack、status/error。
- Runtime Adapter 需要显式支持 `resumeSessionId`。

### 3.2 Heterogeneous Agent CLI

相关文件：

- `refer_proj/lobehub/apps/desktop/src/main/controllers/HeterogeneousAgentCtr.ts`
- `refer_proj/lobehub/apps/desktop/src/main/controllers/ToolDetectorCtr.ts`
- `refer_proj/lobehub/apps/desktop/src/main/controllers/ShellCommandCtr.ts`
- `refer_proj/lobehub/apps/desktop/src/main/controllers/LocalFileCtr.ts`

关键发现：

- HeterogeneousAgentCtr 用 Electron 主进程管理 Claude Code/Codex 子进程。
- Session 模型包含 `agentType`、`command`、`cwd`、`env`、`resumeSessionId`、`agentSessionId`。
- CLI 检测、认证错误、resume 失败、cwd mismatch 都被建模成可解释错误。
- ToolDetectorCtr 可检测 CLI 命令和 Claude auth status。
- GatewayConnectionCtr 把远程 tool call 映射到本地文件、grep、shell command 等受控能力。

对 AgentHub 的影响：

- Claude Code/Codex Adapter 不应是简单 API 调用，应是 Desktop 主进程托管的 CLI 子进程 Adapter。
- Runtime Adapter 错误模型要覆盖 CLI not found、auth required、resume not found、cwd mismatch。
- Desktop Connector 需要 Runtime Detector 和 Local Executor 两层，不应混在聊天 UI 中。

---

## 4. codeg 关键参考

相关文件：

- `refer_proj/codeg/AGENTS.md`
- `refer_proj/codeg/README.md`
- `refer_proj/codeg/src/lib/transport/index.ts`
- `refer_proj/codeg/src/lib/transport/types.ts`
- `refer_proj/codeg/src/lib/transport/web-transport.ts`
- `refer_proj/codeg/src/lib/transport/remote-desktop-transport.ts`
- `refer_proj/codeg/src/lib/transport/tauri-transport.ts`

关键发现：

- codeg 同时支持 Tauri Desktop 和独立 server 模式。
- 前端通过 `Transport` 抽象屏蔽 Tauri invoke、HTTP、WebSocket、remote desktop。
- Transport 不只包含 `call` 和 `subscribe`，还包含：
  - `onReconnect`
  - `waitForReady`
  - `eventStream`
  - reconnect 后 snapshot/replay 的 attach 协议
- README 架构图显示 local filesystem、Git、terminal、chat channels 统一挂到 shared core。

对 AgentHub 的影响：

- AgentHub 应建立 shared transport/API client 层，避免 Web/Mobile/Desktop 各自拼接协议。
- 对实时消息和执行事件，不应只设计「收到就显示」，还要考虑 reconnect、ready handshake、事件丢失和状态补偿。
- 如果 P0 使用 Supabase Realtime，也要保留事件表/snapshot 补偿思路，不能把实时通道当唯一真相。

---

## 5. AionUi 关键参考

相关文件：

- `refer_proj/AionUi/docs/architecture/agent-team-guide-flow.md`
- `refer_proj/AionUi/docs/specs/acp-rewrite/03-architecture-design.md`
- `refer_proj/AionUi/docs/specs/remote-agent/design.md`

关键发现：

- Team 引导流程通过普通 Agent 判断复杂任务，再建议用户进入 Team Mode。
- ACP rewrite 明确提出：
  - 状态机集中。
  - 单队列不变。
  - 只在真实变化轴上抽象。
  - 本地子进程和远程 WebSocket 是真实变化轴。
- Remote Agent 设计区分本地 Agent 和远程 Agent，远程实例独立身份、独立配置、独立连接。

对 AgentHub 的影响：

- Direct Role Flow 升级 Orchestrated Flow 的设计是合理的，应保留用户确认。
- Orchestrator 应由后端状态机托管，避免隐式布尔状态和自由漂移。
- 本地 Runtime、云端 Runtime、远程设备/Connector 是真实变化轴，必须在数据模型中显式区分。

---

## 6. Poco-Claw 关键参考

相关文件：

- `refer_proj/poco-claw/AGENTS.md`
- `refer_proj/poco-claw/backend/tests/*`
- `refer_proj/poco-claw/executor/tests/*`
- `refer_proj/poco-claw/executor_manager/tests/*`

关键发现：

- Poco-Claw 拆成 Frontend、Backend、Executor、Executor Manager。
- 执行过程通过 callback 回传进度，Backend 持久化，Frontend 查询状态。
- 测试覆盖 session、workspace、channel runtime、tool execution、artifact、executor callback。

对 AgentHub 的影响：

- 多服务拆分很清晰，但对 P0 偏重。
- AgentHub P0 可采用一体化后端 + Desktop Connector，后续再拆 Executor/Manager。
- 任务执行事件必须持久化，不能只依赖前端内存状态。

---

## 7. Cherry Studio 关键参考

相关文件：

- `refer_proj/cherry-studio/AGENTS.md`

关键发现：

- Cherry Studio 使用 Electron main/renderer/preload 三进程结构。
- `packages/shared` 存 cross-process types、constants、IPC channel definitions。
- 主进程负责 MCP、provider abstraction、API server、系统服务；渲染进程负责 React UI。

对 AgentHub 的影响：

- `packages/shared` 是必要的，尤其是跨 Web/Desktop/Backend 的 Message、Action、Artifact、Permission、Runtime 类型。
- Electron 主进程本地能力必须通过 typed IPC/preload 暴露给渲染进程，不能让渲染层直接访问 Node 能力。

---

## 8. 对现有推荐路线的修正

本次参考项目反查后，推荐路线保持总体不变，但理由更明确：

| 方向 | 修正后判断 |
| --- | --- |
| Desktop | Electron 仍推荐，因为 LobeHub/Cherry Studio 均证明 Electron 主进程适合本地 CLI、文件、Shell、设备连接 |
| DeviceChannel | P0 直接 WebSocket；DeviceChannel 是接口抽象，参考 LobeHub GatewayClient 和 codeg Transport |
| Runtime Adapter | Claude Code/Codex 应用 CLI 子进程 Adapter，参考 LobeHub HeterogeneousAgentCtr |
| Shared Layer | 必须设 `packages/shared`，参考 Cherry Studio shared package 和 codeg TS transport/types |
| Orchestrator | 后端状态机托管，参考 AionUi ACP rewrite 和 Team flow |
| Execution Events | 需要持久化事件和可恢复状态，参考 codeg snapshot/replay 和 Poco callback persistence |

---

## 9. 2026-05-22 repo-research 全量扫描复核

本轮使用 `repo-research local-scan --refer-dir refer_proj` 扫描现有 `refer_proj/*` 克隆，输出落盘在：

- `research/reference-repos/repo-catalog.json`
- `research/reference-repos/repo-catalog.md`
- `research/reference-repos/agenthub-shortlist.md`
- `research/reference-repos/module-map.md`
- `research/reference-repos/findings-summary.md`
- `research/reference-repos/local-architecture-summary.md`
- `research/reference-repos/scoring-method.md`
- `refer_proj-remotes.txt`

扫描覆盖 43 个本地克隆，其中 `poco-ai/poco-claw` 和 `xintaofei/codeg` 各有重复克隆；人工结论按去重后的仓库处理。自动分数只作为第一轮信号，不能替代人工选型判断。

### 9.1 自动扫描后的降噪原则

| 原则 | 结论 |
| --- | --- |
| 不按 Star 直接选型 | `NextChat`、通用聊天客户端等成熟度高，但对 AgentHub 的 Runtime Adapter 和 Desktop Connector 价值有限 |
| 优先看真实变化轴 | Claude/Codex CLI、PTY、resume、Device Gateway、持久化事件、approval、artifact 才是 P0 技术风险 |
| 低星高相关要上浮 | `wuxiran/cc-pane`、`mz-zs/codex-session-migrator`、`shuxueshuxue/ccm-orchestra` 等需要保留为专项候选 |
| 大项目只借鉴边界 | `lobehub`、`clawwork-ai/ClawWork`、`desktop-cc-gui` 不应整体复制，只提取可落地的接口、状态机和目录边界 |

### 9.2 新增重点参考项目

| 项目 | 主要覆盖 FR-ID | 关键证据 | 对 AgentHub 的结论 |
| --- | --- | --- | --- |
| `refer_proj/wuxiran__cc-pane` | `FR-RUNTIME-001`, `FR-DESK-001`, `FR-CTX-001`, `FR-ACTION-001` | `cc-cli-adapters/src/{claude,codex}.rs` 显式建模 `supports_resume`、MCP 注入、hook 支持、`resume_id`；`src-tauri/src/commands/history_commands.rs` 扫描 Claude/Codex 原生会话；Tauri + xterm.js + portable-pty | Runtime Adapter 深挖第一候选。AgentHub 应借鉴能力声明、resume 参数、per-session MCP/config 隔离和会话 ID 回填，但 P0 不采用 Tauri/Rust 作为 Desktop 主路线 |
| `refer_proj/clawwork-ai__ClawWork` | `FR-DEVICE-001`, `FR-DESK-001`, `FR-MOB-001`, `FR-ARTIFACT-001`, `FR-PERM-001`, `FR-ORCH-001` | `packages/shared/src/gateway-protocol.ts` 定义 req/res/event frame；`constants.ts` 统一 session key；`docs/architecture-invariants.md` 明确 shared/desktop/preload/renderer 权责；PWA 与 Desktop 共用 core/shared | Task/Session/Artifact/Approval 和 PWA/desktop 分层深挖第一候选。AgentHub 可借鉴 shared 协议包、session key builder、artifact 本地持久化和三栏任务工作台 |
| `refer_proj/zhukunpenglinyutong__desktop-cc-gui` | `FR-RUNTIME-001`, `FR-CTX-001`, `FR-RESULT-001`, `FR-DESK-001` | README 显示 Claude Code、Codex、OpenCode、Gemini 多引擎；`docs/markdown-doc1-claude-chat-canvas-rendering.md`、`docs/markdown-doc2-codex-chat-canvas-rendering.md` 记录实时和历史渲染链路；`docs/architecture/harness-governance-strategy.md` 讨论跨引擎治理 | 多引擎聊天幕布、历史恢复、上下文治理可参考；但该项目更像本地 VibeCoding IDE，AgentHub P0 不应把 Web 主工作台做成完整 IDE |
| `refer_proj/wuxiran__cc-pane/cc-panes-api` | `FR-DESK-001`, `FR-ACTION-001`, `FR-RUNTIME-001` | 存在独立 HTTP/WebSocket API adapter 目录 | 可作为后续「本地桌面暴露受控 API」的参考，但 P0 仍以云端后端转发到 Desktop Connector 为主 |
| `refer_proj/mz-zs__codex-session-migrator` | `FR-RUNTIME-001`, `FR-CTX-001` | 低星但命中 Codex session migration 场景 | 放入 Codex session/resume 专项深挖，不参与整体架构选型排名 |

### 9.3 模块级候选收敛

| AgentHub 模块 | 首选参考 | 辅助参考 | 不建议作为主参考 |
| --- | --- | --- | --- |
| Runtime Adapter | `lobehub`, `wuxiran__cc-pane`, `desktop-cc-gui` | `SeemSeam__claude_codex_bridge`, `codex-session-migrator` | `NextChat`，聊天客户端成熟但不是 CLI Runtime Adapter 代表 |
| Desktop Connector | `lobehub`, `cherry-studio`, `ClawWork` | `cc-pane`, `codeg` | 纯 Web/PWA 项目 |
| Device Gateway / WebSocket | `lobehub`, `ClawWork`, `codeg` | `cc-pane` | 只做本地终端面板、无远程设备通道的项目 |
| Orchestrator / Team Mode | `AionUi`, `ClawWork`, `poco-claw` | `ccm-orchestra`, `Claude-Code-Multi-Agent` | 大而泛的个人聊天客户端 |
| Artifact / Diff / Preview | `ClawWork`, `poco-claw`, `lobehub` | `cc-pane` 本地 history/diff | 只做消息展示、不落 artifact 的项目 |
| Mobile / PWA | `ClawWork`, `NextChat`, `NitroRCr/AIaW` | `cherry-studio-app`, `rikkahub` | 重桌面 IDE 项目 |

### 9.4 对技术路线的增量修正

| 技术点 | 修正后建议 | 绑定 FR-ID |
| --- | --- | --- |
| Runtime Adapter 能力声明 | 在 `packages/shared` 中定义 `RuntimeCapability`，至少包含 `supportsResume`、`supportsProjectHooks`、`supportsMcp`、`supportsWorkspace`、`supportsStreamingEvents` | `FR-RUNTIME-001`, `FR-AGENT-001` |
| Native session 绑定 | AgentHub 的 `runtime_sessions` 必须同时保存 AgentHub session/role 关系和原生 `nativeSessionId`；首次启动后允许异步回填 native ID | `FR-RUNTIME-001`, `FR-CTX-001` |
| MCP/config 隔离 | Claude/Codex 启动参数和 MCP 配置必须按 runtime session 隔离，避免修改用户全局配置作为唯一机制 | `FR-RUNTIME-001`, `FR-PERM-001` |
| Gateway 协议 | DeviceChannel 帧建议采用 `req/res/event` 三类，事件带 `seq`，后端以持久化事件表作为真相 | `FR-DESK-001`, `FR-ACTION-001`, `FR-NOTIFY-001` |
| Artifact 持久化 | 产物文件是 durable output，数据库只索引 metadata/search；消息里只引用 artifact ID/path | `FR-ARTIFACT-001`, `FR-RESULT-001` |
| PWA 边界 | Mobile P0 可走 PWA，但共享 `packages/shared` 的协议和状态机，不共享 Web 的密集桌面 UI | `FR-MOB-001`, `FR-DEVICE-001` |

### 9.5 建议 Top 5 深挖顺序

1. `lobehub/lobehub`：Device Gateway、Electron 主进程、Claude/Codex heterogeneous agent。
2. `wuxiran/cc-pane`：CLI adapter 能力声明、PTY、resume、per-session MCP/config 隔离。
3. `clawwork-ai/ClawWork`：Gateway protocol、Task/Session/Artifact/Approval、PWA + Desktop 分层。
4. `xintaofei/codeg`：Transport 抽象、reconnect、snapshot/replay。
5. `iOfficeAI/AionUi`：ACP rewrite、状态机集中、Team Mode。

如果只做一个 Runtime Adapter 专项深挖，优先选 `wuxiran/cc-pane`；如果只做一个三端/协议专项深挖，优先选 `ClawWork`。
