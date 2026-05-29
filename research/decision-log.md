# AgentHub 决策日志

> 记录关键产品与技术决策。每条决策包含背景、选项、结论和影响范围。

---

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
