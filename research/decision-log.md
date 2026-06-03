# AgentHub 决策日志

> 记录关键产品与技术决策。每条决策包含背景、选项、结论和影响范围。

---

## DEC-008: Bytedance 原始 PRD 作为最高产品事实源

| 字段 | 内容 |
|------|------|
| **日期** | 2026-06-03 |
| **决策者** | joytion |
| **状态** | ✅ 已确认 |
| **FR-ID** | 全部 FR-ID |

### 背景

用户明确指出当前 PRD 不再可信，后续应“按照 `bytedance_init_prd.md` 说的来”，并要求更新 PRD、产品设计、技术设计和 Trellis 规范。

### 决策

AgentHub 产品事实源优先级改为：

1. `bytedance_init_prd.md`
2. `bytedance_init_video_txt.txt`
3. 用户最新明确决策
4. `research/prd.md`
5. 产品设计、技术设计、contracts、tracker、report、Trellis task 和代码证据

`research/prd.md` 是派生 FR-ID 注册表，不是根事实源。若派生 PRD、产品设计、技术设计或实现与 Bytedance 原始材料冲突，先更新文档和 FR-ID，再进入实现。

### 影响

- Bytedance 明确要求但 P0 未完成的能力必须进入 backlog，不得从产品事实中删除。
- 消息回复/引用/重新生成/Diff 操作、Artifact 二次编辑/版本/局部修改、文档/PPT、部署发布、OpenCode、多端补全等能力必须保留阶段口径。
- Trellis 任务必须绑定 Bytedance 原始来源和派生 FR-ID。
- 审计完成度时必须能识别 `source_doc_drift`：原始 Bytedance 有要求，但派生 PRD 或技术文档漏登。

## DEC-001: P0 认证方案选型

| 字段 | 内容 |
|------|------|
| **日期** | 2026-05-21（初始）→ 2026-05-27（修订） |
| **决策者** | joytion |
| **状态** | ✅ 已确认 |
| **FR-ID** | FR-AUTH-001 |

### 背景

AgentHub P0 需要 GitHub OAuth 登录，三端共享身份。初始调研推荐 Auth.js（同时服务 Auth + DB + Realtime）。后续发现本地开发和 E2E 测试对 external BaaS 控制台强依赖，阻碍 Demo 流畅度。

### 评估选项

| 选项 | 结论 |
|------|------|
| A. Auth.js + GitHub OAuth | ❌ 放弃 — 本地开发/E2E 强依赖外部服务 |
| B. Auth.js v5 + GitHub OAuth + 自管 Postgres | ✅ 采纳 |
| C. 自建 GitHub OAuth | ❌ 重复造轮子 |

### 最终决策

采用 **Auth.js v5 + GitHub OAuth Provider**：
- DB session 存储（非 JWT）
- Drizzle adapter 连接 Postgres
- 本地开发用 local Postgres，零外部依赖
- DB 查询层暂保留 Postgres client（仅作 Postgres 客户端）
- 设备绑定自建 device token 逻辑

### 锁定决策项

- L1: Auth.js v5 + GitHub OAuth
- L2: 保留 GitHub OAuth（不换其他 provider）
- L3: 自建 device token（不依赖 Auth.js session）
- L4: DB 层暂保留 Postgres
- L5: 本地开发用 local Postgres

### 影响范围

- `apps/web/middleware.ts` — 重写
- `apps/web/app/auth/` — 替换
- `apps/web/lib/app-db-client.ts` — auth 部分移除
- 全部 API routes auth guard — 替换为 Auth.js session
- `packages/shared/src/database.types.ts` — 新增 auth schema

---

## DEC-002: Workspace 执行域模型

| 字段 | 内容 |
|------|------|
| **日期** | 2026-05-21 |
| **决策者** | joytion |
| **状态** | ✅ 已确认 |
| **FR-ID** | FR-WS-001, FR-RUNTIME-001 |

### 决策

Workspace 创建后执行域（`cloud` | `local_desktop`）不可变。Session 继承 Workspace 执行域，Role Agent Runtime 必须匹配执行域。

### 理由

避免 Session、Runtime、Action 历史混乱；Web/Mobile 是控制端而非执行端。

---

## DEC-003: Desktop 设备绑定方式

| 字段 | 内容 |
|------|------|
| **日期** | 2026-05-21 |
| **决策者** | joytion |
| **状态** | ✅ 已确认 |
| **FR-ID** | FR-DEVICE-001 |

### 决策

P0 使用一次性设备绑定码（Web 生成，Desktop 输入）。后续可补 Desktop 直接 GitHub OAuth。

### 理由

避免 OAuth 回调和桌面深链处理的复杂性；Device Code Flow 适合 CLI/Desktop 场景。

---

## DEC-004: Cloud Runtime Gateway 是必需 Runtime 实体

| 字段 | 内容 |
|------|------|
| **日期** | 2026-05-29 |
| **决策者** | joytion |
| **状态** | ✅ 已确认 |
| **FR-ID** | FR-RUNTIME-001, FR-DEVICE-001, FR-DESK-001, FR-MOB-001 |

### 背景

P1 Runtime 初版规划把 Cloud Runtime 当作可选 provider，把 HostedRuntimeAdapter 设想为直连某个真实云端服务。用户澄清后，该模型不足以表达用户本地 Claude Code/Codex 通过云端转发到 Web/Mobile 的产品形态。

### 决策

AgentHub 必须有 **Cloud Runtime Gateway / Relay** 实体：

- `public_cloud`：AgentHub 官方公共 Claude Code/Codex Runtime 池，提供给用户直接使用。
- `user_local`：用户自己的 Desktop 本地 Claude Code/Codex Runtime，通过 Cloud Gateway relay/tunnel 暴露给 Web/Mobile。
- Web/Mobile 不直连用户本机 IP/端口，所有 runtime 请求统一进入 Cloud Runtime Gateway。
- Desktop 本地 Runtime 可以监听本地端口或由 Desktop main 启动子进程，但必须通过云端 Gateway 建立 device/channel/tunnel。

### 影响

- `research/contracts/P1-RUNTIME-GATEWAY.md` 成为 P1 Runtime 权威合同。
- D-003 从“是否需要 cloud provider”重定义为“全部自建：Cloud Gateway / runtime worker / DB / cache 使用官方镜像或开源实现自部署”。
- HostedRuntimeAdapter 不再表示“直连某个云端服务”，而是 Gateway 客户端/契约边界。
- Phase 1 可先实现 Gateway 契约、DB 实体、路由和事件语义；public_cloud 自建 worker/pool 实现进入后续 Phase。

---

## DEC-005: 基础设施默认自建，拒绝包装型托管平台依赖

| 字段 | 内容 |
|------|------|
| **日期** | 2026-05-29 |
| **决策者** | joytion |
| **状态** | ✅ 已确认 |
| **FR-ID** | FR-RUNTIME-001, FR-DEVICE-001, NFR-SEC-001, NFR-OBS-001 |

### 决策

AgentHub 的核心基础设施默认自建，不使用 Supabase、Fly、Neon、Upstash、Vercel Postgres、PlanetScale、Railway、Render、Firebase、Clerk/Auth0 等包装型托管平台作为产品依赖。

允许的路线：

- PostgreSQL：官方 Postgres 镜像、本地 Docker、自管服务器或自管集群。
- Redis/cache/queue：官方 Redis 或开源替代产品自部署。
- Runtime Gateway / worker：AgentHub 自建服务。
- Auth：Auth.js v5 + GitHub OAuth + 自管 Postgres session。

### 理由

AgentHub 不做依赖别人服务能力的平台。数据库、认证、Runtime、队列和日志都应可由用户或项目方自行部署、迁移和审计。

### 影响

- 新增依赖前必须检查是否为包装型托管平台 SDK。
- 若只是使用开源协议或官方客户端（例如 `pg`、官方 Redis client），可以接受。
- 已存在的历史 `.workflow/scratch`、归档报告保留审计轨迹；active docs 和后续实现必须遵守本决策。

---

## DEC-006: 三端会话工作台与权限模型统一

| 字段 | 内容 |
|------|------|
| **日期** | 2026-05-31 |
| **决策者** | joytion |
| **状态** | ✅ 已确认 |
| **FR-ID** | FR-WEB-001, FR-DESK-001, FR-MOB-001, FR-CHAT-001, FR-PERM-001, FR-NOTIFY-001, FR-ACTION-001, FR-ARTIFACT-001, FR-RESULT-001, FR-UI-001 |

### 背景

Desktop 的“批准/拒绝”功能如果作为独立审批中心，会和 Web/Mobile 的审批入口重复；如果用户在 Web/Mobile 已授权后还必须打开 Desktop 二次确认，本地执行链路会变得低效。

### 决策

AgentHub 采用统一三端会话工作台与权限模型：

- Web 是完整 Session 工作台，承载 Composer、Run 卡、权限模式、授权卡、Context/Changes/Artifacts、Git diff、artifact、搜索。
- Desktop 是本机 Host/控制台，承载本机权限预设、Runtime/CLI 状态、本机执行代理、执行日志、本机策略审计记录、策略镜像和本地校验。
- Mobile/PWA 是远程监督控制端，参考 OpenAI Codex mobile 形态，查看线程、Run、diff、artifact、测试结果并处理授权。
- 后端是策略事实源、授权记录、审计和三端状态同步源。
- Desktop 不做审批中心，不弹二次确认。超出策略但可授权的动作回 Web/Mobile 当前 Session 请求授权。

### 影响

- `research/contracts/THREE-SURFACE-WORKBENCH-PERMISSION-001.md` 成为后续实现共享合同。
- `research/prd-amendments/2026-05-31-three-surface-workbench-permission-model.md` 记录 confirmed PRD 修订。
- `research/product/product-design.md`, `research/product/ui-design-system.md`, `research/product/desktop-p0-ui-ux-contract.md` 已同步 Desktop Host、Mobile 远程监督和授权卡语义。
- 后续实现必须先产出参考组件迁移清单，优先参考 codeg、AionUi、OpenAI Codex 和成熟 diff/artifact 组件，但以 AgentHub 数据模型和统一视觉系统重写落地。

---

## DEC-007: AI 工作台组件长期采用成熟参考实现演进

| 字段 | 内容 |
|------|------|
| **日期** | 2026-06-03 |
| **决策者** | joytion |
| **状态** | ✅ 已确认 |
| **FR-ID** | FR-WEB-001, FR-MOB-001, FR-CHAT-001, FR-ORCH-001, FR-PERM-001, FR-ACTION-001, FR-ARTIFACT-001, FR-RESULT-001, FR-UI-001 |

### 决策

AgentHub 的 AI Chat、权限确认、Artifact 和 Workbench 不再继续按零散自研组件推进，而是采用“成熟参考实现 + AgentHub 数据合同适配”的长期路线：

- Chat Thread、Composer、tool call、human approval 优先参考 `assistant-ui` 和 `vercel/ai-elements`。
- Artifact 类型化、Streamdown 配置和完整 Next.js AI Chat 架构参考 `vercel/chatbot`。
- 文件树、编辑器、预览、终端和 workbench 交互参考 `stackblitz/bolt.new`。
- Agent 工作台状态、runtime、权限/RBAC 和恢复模型参考 `OpenHands`。

第一波不直接引入大依赖，而是先把当前 `ChatPanel` 拆出消息内容、runtime part、权限卡和 Composer 边界，后续逐步替换内部实现。

### 影响

- `research/reference-repos/agent-ui-component-evolution-roadmap.md` 成为后续组件迁移路线入口。
- 参考项目只能提供组件结构、交互和状态机经验，不能覆盖 AgentHub 的 Role Agent、Workspace 执行域、Approval、Runtime 凭证边界和三端职责。
- 新增 UI 任务必须写明采用/不采用的参考来源，并保持中文文案、Tailwind 4 语义 token、lucide 图标和视觉 E2E 门禁。
