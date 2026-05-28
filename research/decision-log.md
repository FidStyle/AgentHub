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
