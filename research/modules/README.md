# AgentHub Phase 2 模块调研索引

**日期：** 2026-05-25
**状态：** Phase 2 已收敛，结论已进入 `research/technical-design.md`

---

## 1. 模块文档列表

| 文档 | 覆盖范围 | 主要 FR-ID |
| --- | --- | --- |
| `reference-projects.md` | `refer_proj/*` 参考项目架构依据 | `FR-DEVICE-001`, `FR-DESK-001`, `FR-RUNTIME-001`, `FR-ACTION-001`, `FR-ORCH-001` |
| `client-shells.md` | Web/Desktop/Mobile 壳与代码共享 | `FR-DEVICE-001`, `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001` |
| `ui-and-visual-testing.md` | 三端 UI 设计系统、组件库、视觉 E2E 工具链 | `FR-UI-001`, `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001` |
| `auth-workspace.md` | GitHub OAuth、Workspace、执行域 | `FR-AUTH-001`, `FR-WS-001`, `FR-PERM-001` |
| `im-foundation.md` | IM 底座、实时通信、富消息 | `FR-CHAT-001`, `FR-ARTIFACT-001`, `FR-RESULT-001`, `FR-NOTIFY-001` |
| `desktop-connector.md` | 本地 Connector、本地执行边界 | `FR-DESK-001`, `FR-RUNTIME-001`, `FR-ACTION-001` |
| `runtime-adapters.md` | Claude Code/Codex Runtime Adapter | `FR-RUNTIME-001`, `FR-AGENT-001`, `FR-CTX-001` |
| `action-cli-adapter.md` | Action/CLI、预览、权限确认 | `FR-ACTION-001`, `FR-PERM-001`, `FR-RESULT-001` |
| `orchestrator.md` | Orchestrator 状态机、计划分派、handoff | `FR-ORCH-001`, `FR-CTX-001`, `FR-PERM-001` |
| `orchestrator-plan-dag.md` | Orchestrator Plan DAG、依赖、并行 wave、失败影响范围 | `FR-ORCH-001`, `FR-CTX-001`, `FR-AGENT-001`, `FR-RUNTIME-001`, `FR-PERM-001`, `FR-RESULT-001` |
| `../automation-reference-comparison.md` | Maestro-Flow 与 CodeStable 的自动化执行、需求反写和参考项目注入规则 | `FR-ORCH-001`, `FR-CTX-001`, `FR-UI-001`, `FR-PERM-001`, `FR-RESULT-001`, `NFR-OBS-001` |

---

## 2. 推荐技术路线汇总

| 模块 | 推荐项 | 理由 |
| --- | --- | --- |
| 三端壳 | Web: Next.js；Desktop: Electron；Mobile P0: PWA；Android App 预留: Capacitor；React Native 预留: shared TS 领域层 | 最快满足三端职责分工，同时保留后续 Android 应用和原生移动端路线 |
| UI 设计系统 | shadcn/ui + Tailwind CSS 4 + lucide-react；codeg/shadcn 为三端统一视觉母版；Playwright 分端视觉 E2E | 与当前 Web 技术栈兼容，可覆盖 Web、Electron renderer、Mobile/PWA，并把视觉质量纳入门禁 |
| Auth/Workspace | Auth.js + GitHub OAuth + Postgres | 同时解决登录、DB、Realtime 基础设施 |
| IM/Realtime | database-backed realtime | 与 Auth/DB 统一，足够支撑消息、审批、状态同步 |
| Desktop Connector | Electron + DeviceChannel 接口 + WebSocket 主实现 | Node 主进程适合本地 CLI、文件、进程能力；WebSocket 适合远程控制和状态回传 |
| Runtime Gateway / Adapter | Cloud Runtime Gateway 必需实体 + Claude Code/Codex Adapter；Gateway 统一承载 public_cloud 官方池与 user_local Desktop tunnel | 满足 Web/Mobile 统一访问、用户本地 Runtime 云端转发、native session resume/continue 的核心产品差异 |
| Action/CLI | preview/test/build/shell 统一 ActionRequest | 覆盖 Demo，同时给未来部署发布留扩展点 |
| Orchestrator | 后端状态机托管 + Plan DAG，LLM 生成候选计划和总结，系统校验依赖并调度 ready nodes | 保证可解释、可审批、可测试，并满足并行调度、失败降级和 handoff |
| 自动化执行治理 | Maestro-Flow 作为执行闭环参考，CodeStable 作为需求暂停与验收回写参考 | 既能自动推进 plan/execute/verify/test，又能在需求不清、UI 契约缺失或参考项目冲突时停下来反写 PRD |

---

## 3. React-first 代码共享原则

P0 可以 all in React/TypeScript 生态，但共享边界必须放在纯业务层，而不是 Web UI 层。

| 可共享 | 不承诺共享 |
| --- | --- |
| Workspace、Session、Message、Artifact、Action、Permission、Runtime 类型 | DOM 组件 |
| API client | CSS/Tailwind class |
| 消息、Action、权限、执行域状态机 | 浏览器专属 API |
| 不依赖 DOM 的 hooks | Web UI 组件库 |

推荐目录方向：

```text
apps/web
apps/desktop
packages/shared
future apps/mobile-native
```

未来如果转向 React Native/Expo，优先复用 `packages/shared`，移动 UI 重新实现。

---

## 4. 参考项目校准

本轮调研已补充 `refer_proj/*` 依据，详见 `reference-projects.md`。关键校准：

- LobeHub 已有 `device-gateway-client`，证明 Desktop 主动 WebSocket + auth + heartbeat + reconnect + tool/agent request 是可行路线。
- LobeHub `HeterogeneousAgentCtr` 已用 Electron 主进程托管 Claude Code/Codex CLI 子进程，支持 `resumeSessionId`，强化 AgentHub 的 CLI Adapter 方向。
- cc-pane 的 `cc-cli-adapters` 证明 Claude/Codex 能力声明、PTY、resume、per-session MCP/config 隔离需要进入 Runtime Adapter 设计。
- ClawWork 证明 Task/Session/Artifact/Approval、Gateway req/res/event 协议、PWA + Desktop 分层可以用 shared 协议包统一。
- codeg 的 `Transport` 抽象证明 Web/Tauri/remote desktop 可以共享 call/subscribe/eventStream 使用模型，AgentHub 应建立 shared transport/API client。
- AionUi ACP rewrite 证明 Orchestrator/Agent session 必须集中状态机和单队列，避免隐式状态。
- LobeHub `GraphAgent`、`taskGraph` 和 codeApe orchestration schema 证明 Orchestrator 计划应使用结构化 DAG、dependsOn、ready/waiting/blocked buckets，而不是仅保存自然语言步骤。
- maestro-flow 的 wave DAG 证明 P0 可用并行组/波次表达依赖，不必先做复杂 DAG 编辑器。
- CodeStable 的 requirement/design/implementation/acceptance 流程证明，执行中发现需求、接口契约或验收标准不清时必须暂停并回写需求或设计，而不是在代码里隐式做决定。
- Poco-Claw 证明多服务 executor/callback 架构完整但偏重，AgentHub P0 暂不拆成独立 executor-manager。

---

## 5. 已确认结论

以下路线已进入 `research/technical-design.md`，模块文档只保留研究依据：

1. 三端壳：Next.js + Electron + PWA；后续 Android App 用 Capacitor 包装。
2. UI 设计系统：`shadcn/ui + Tailwind CSS 4 + lucide-react`，视觉 E2E 使用 Playwright browser projects 与 Playwright Electron 分端覆盖。
3. Auth/DB/Realtime：P0 使用 external BaaS 作为基础设施。
4. Desktop 通道：`DeviceChannel` 作为接口，P0 直接使用 WebSocket 实现。
5. Runtime Gateway / Adapter：P1 起 Cloud Runtime Gateway 是必需实体；public_cloud 官方 runtime 池和 user_local Desktop 本地 runtime 都必须经 Gateway 暴露。Claude Code/Codex 本地执行仍走 CLI 子进程，不用普通 API 模拟。
6. Orchestrator：后端状态机托管，Plan DAG 作为结构化计划，LLM 只负责内容生成。
7. 自动化执行：参考 Maestro-Flow 的 plan/execute/verify/review/test/fix-loop，但参考 CodeStable 的需求暂停、PRD 反写和验收回写机制防止自动化跑偏。

如果后续实现发现技术设计与模块研究冲突，以 `research/technical-design.md` 为准，再反向修正对应模块文档。
