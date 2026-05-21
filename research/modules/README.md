# AgentHub Phase 2 模块调研索引

**日期：** 2026-05-21  
**状态：** Draft，等待用户确认后进入 `research/technical-design.md`

---

## 1. 模块文档列表

| 文档 | 覆盖范围 | 主要 FR-ID |
| --- | --- | --- |
| `client-shells.md` | Web/Desktop/Mobile 壳与代码共享 | `FR-DEVICE-001`, `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001` |
| `auth-workspace.md` | GitHub OAuth、Workspace、执行域 | `FR-AUTH-001`, `FR-WS-001`, `FR-PERM-001` |
| `im-foundation.md` | IM 底座、实时通信、富消息 | `FR-CHAT-001`, `FR-ARTIFACT-001`, `FR-RESULT-001`, `FR-NOTIFY-001` |
| `desktop-connector.md` | 本地 Connector、本地执行边界 | `FR-DESK-001`, `FR-RUNTIME-001`, `FR-ACTION-001` |
| `runtime-adapters.md` | Claude Code/Codex Runtime Adapter | `FR-RUNTIME-001`, `FR-AGENT-001`, `FR-CTX-001` |
| `action-cli-adapter.md` | Action/CLI、预览、权限确认 | `FR-ACTION-001`, `FR-PERM-001`, `FR-RESULT-001` |
| `orchestrator.md` | Orchestrator 状态机、计划分派、handoff | `FR-ORCH-001`, `FR-CTX-001`, `FR-PERM-001` |

---

## 2. 推荐技术路线汇总

| 模块 | 推荐项 | 理由 |
| --- | --- | --- |
| 三端壳 | Web: Next.js；Desktop: Electron；Mobile P0: PWA；Android App 预留: Capacitor；React Native 预留: shared TS 领域层 | 最快满足三端职责分工，同时保留后续 Android 应用和原生移动端路线 |
| Auth/Workspace | Supabase Auth + GitHub OAuth + Postgres | 同时解决登录、DB、Realtime 基础设施 |
| IM/Realtime | Supabase Realtime | 与 Auth/DB 统一，足够支撑消息、审批、状态同步 |
| Desktop Connector | Electron + DeviceChannel 接口 + WebSocket 主实现 | Node 主进程适合本地 CLI、文件、进程能力；WebSocket 适合远程控制和状态回传 |
| Runtime Adapter | Claude Code/Codex 均走 CLI 子进程 Adapter | 满足 native session resume/continue 的核心产品差异 |
| Action/CLI | preview/test/build/shell 统一 ActionRequest | 覆盖 Demo，同时给未来部署发布留扩展点 |
| Orchestrator | 后端状态机托管，LLM 生成计划和总结 | 保证可解释、可审批、可测试 |

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

## 4. 当前待确认问题

建议一次性确认以下路线：

1. 三端壳是否接受：Next.js + Electron + PWA，后续 Android App 用 Capacitor 包装？
2. Auth/DB/Realtime 是否接受：Supabase 作为 P0 后端基础设施？
3. Desktop 通道是否接受：DeviceChannel 作为接口，P0 直接使用 WebSocket 实现？
4. Runtime Adapter 是否接受：Claude Code/Codex P0 都必须走 CLI 子进程，不用普通 API 模拟？
5. Orchestrator 是否接受：后端状态机托管，LLM 只负责内容生成？

我的整体建议是全部选推荐路线。这样最符合当前 PRD 的 P0 目标：三端闭环、真实本地 Runtime 接入、IM 体验、审批和产物展示。
