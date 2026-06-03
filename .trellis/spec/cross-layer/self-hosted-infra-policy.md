# 自建基础设施策略

## 场景：新增基础设施或第三方 SDK 前的边界检查

### 1. 范围与触发条件

- 触发条件：新增数据库、认证、缓存、队列、Runtime worker、部署平台、日志/观测、Realtime、对象存储或相关 SDK。
- 决策来源：`research/decision-log.md` 的 `DEC-005`。
- 目标：AgentHub 不依赖 Supabase、Fly、Neon、Upstash、Vercel Postgres、PlanetScale、Railway、Render、Firebase、Clerk/Auth0 等包装型托管平台。

### 2. Signatures

允许的基础设施形态：

```typescript
type InfraDeploymentMode = 'self_hosted_docker' | 'self_managed_server' | 'self_managed_cluster';
type DatabaseEngine = 'postgres';
type CacheEngine = 'redis' | 'valkey' | 'dragonfly';
type RuntimeWorkerMode = 'agenthub_self_hosted_worker';
```

禁止作为产品依赖的形态：

```typescript
type ForbiddenManagedPlatform =
  | 'supabase'
  | 'fly'
  | 'neon'
  | 'upstash'
  | 'vercel_postgres'
  | 'planetscale'
  | 'railway'
  | 'render'
  | 'firebase'
  | 'clerk'
  | 'auth0'
  | 'convex'
  | 'turso';
```

### 3. Contracts

- PostgreSQL 使用官方 Postgres、本地 Docker、自管服务器或自管集群；不要引入 Neon、Supabase、Vercel Postgres、PlanetScale 等包装 SDK。
- Redis/cache/queue 使用官方 Redis 或开源替代（例如 Valkey、Dragonfly）自部署；不要引入 Upstash 作为产品依赖。
- Runtime Gateway / public_cloud worker 使用 AgentHub 自建服务；不要引入 Fly、Modal、Railway、Render 等托管运行平台作为默认路线。
- Auth 使用 Auth.js v5 + GitHub OAuth + 自管 Postgres session；不要引入 Clerk/Auth0/Firebase Auth 作为产品依赖。
- 历史 research/.workflow 记录可以保留平台名称作为审计轨迹，但 active contract/spec/plan 不得把它们作为候选路线。

### 4. Validation & Error Matrix

| 条件 | 处理 |
| --- | --- |
| `package.json` 新增包装平台 SDK | 拒绝计划或要求替换为官方协议/自建客户端 |
| 文档将 Supabase/Fly/Neon/Upstash 等列为待选路线 | 更新为自建路线，历史报告加 superseded 注记 |
| 需要 Postgres | 使用 `pg` / node-postgres、Drizzle + Postgres、自管 `DATABASE_URL` |
| 需要 Redis/queue | 使用官方 Redis 协议客户端 + 自部署 Redis/Valkey/Dragonfly |
| 需要 runtime worker | 实现 AgentHub 自建 worker，不接入托管运行平台 |

### 5. Good/Base/Bad Cases

- Good: `docker compose` 启动 Postgres/Redis/Gateway worker，应用通过 `DATABASE_URL` 和内部服务 URL 连接。
- Base: Phase 还没部署 public_cloud worker，endpoint 状态为 `unconfigured`，但 Gateway DB/事件/错误语义可测。
- Bad: 为了快速上线引入 `@neondatabase/serverless`、`@upstash/redis`、Fly Machines SDK 或 Supabase SDK，并把它作为产品运行依赖。

### 6. Tests Required

- 依赖扫描：`rg -n -i "supabase|fly|neon|upstash|vercel/postgres|planetscale|firebase|clerk|auth0|turso|convex" package.json apps packages scripts docker research .trellis .workflow/roadmap.md`
- Type-check：受影响 packages 必须通过。
- 对 DB/cache/runtime 变更：必须有 self-hosted Docker 或自管连接字符串下的 smoke/integration 测试。

### 7. Wrong vs Correct

#### Wrong

```json
{
  "dependencies": {
    "@neondatabase/serverless": "^1.1.0",
    "@upstash/redis": "^1.0.0"
  }
}
```

#### Correct

```json
{
  "dependencies": {
    "pg": "^8.0.0",
    "redis": "^4.0.0"
  }
}
```

Correct only means the package is protocol/open-source compatible; the actual deployment must still be self-hosted.

## Scenario: Hash Release Static Deploy With Caddy

### 1. Scope / Trigger

- Trigger: Adding or changing self-hosted production deployment for AgentHub Web.
- Applies to Dockerfile, Docker Compose, Caddyfile, deploy staging scripts, package dependency declarations, and docs that describe production startup.

### 2. Signatures

- Static stage command: `pnpm deploy:web:stage`
  - Builds `@agenthub/web`.
  - Reads `apps/web/.next/BUILD_ID`.
  - Writes `deploy/self-hosted/releases/<BUILD_ID>/public`.
  - Writes Next static assets to `deploy/self-hosted/releases/<BUILD_ID>/public/_next/static`.
  - Updates `deploy/self-hosted/current` to point at the active hash release.
- Compose config command: `AUTH_SECRET=... CADDY_HTTP_PORT=<lane-port> APP_BASE_URL=http://localhost:<lane-port> AUTH_URL=http://localhost:<lane-port> NEXTAUTH_URL=http://localhost:<lane-port> pnpm deploy:self-hosted:config`.
- Public route: Caddy publishes the lane port and proxies to internal app service `app:3000`.

### 3. Contracts

- App service must use `expose: ["3000"]` or equivalent internal-only networking; it must not publish host ports directly.
- Caddy is the only public HTTP entrypoint for self-hosted deploy.
- Caddy serves `/_next/static/*` and existing public files from `deploy/self-hosted/current/public`, then reverse-proxies all remaining requests to `app:3000`.
- Deployment output directories under `deploy/self-hosted/` are generated artifacts and must stay ignored by git.
- Package-local build requirements must be declared by the package that owns the imported file. Example: if `packages/ui/src/globals.css` imports `tailwindcss`, `packages/ui/package.json` must declare `tailwindcss`; do not rely on another app's hoisted dependency.

### 4. Validation & Error Matrix

| 条件 | 必须结果 |
| --- | --- |
| `.next/BUILD_ID` missing | staging script fails with an explicit "run build first" error |
| `.next/static` missing | staging script fails; do not create a partial release |
| Caddy config invalid | `caddy validate` fails before handoff |
| Compose config uses default or unknown port in parallel worktree | not accepted as final evidence; rerun with the lane's fixed port |
| Docker build cannot resolve package-local CSS/type dependencies | add the dependency to the owning package manifest and refresh lockfile |

### 5. Good/Base/Bad Cases

- Good: `pnpm deploy:web:stage` creates a hash release; `CADDY_HTTP_PORT=3101 ... pnpm deploy:self-hosted:config` shows only Caddy publishing `3101:80` and app exposing internal `3000`; Docker image build succeeds.
- Base: Local static stage and Compose config pass, but full stack is not started because secrets or OAuth credentials are unavailable; report this as config/build verification only.
- Bad: Next app publishes `3000:3000` directly, Caddy is bypassed, or deploy docs rely on managed platforms.

### 6. Tests Required

- `pnpm install --frozen-lockfile`.
- `pnpm type-check`, `pnpm lint`, and `pnpm test`.
- `pnpm deploy:web:stage`, then assert `deploy/self-hosted/current/manifest.json` and `deploy/self-hosted/current/public/_next/static` exist.
- Fixed-port Compose validation for the current lane, for example deploy-v1 uses `http://localhost:3101`.
- Docker app image build: `docker compose -p agenthub_deploy -f docker/docker-compose.deploy.yml build app`.
- Caddy syntax validation: `docker run --rm -v "$PWD/docker/Caddyfile.deploy:/etc/caddy/Caddyfile:ro" caddy:2.8-alpine caddy validate --config /etc/caddy/Caddyfile`.
- Managed-platform scan over product code/config: `rg -n -i "supabase|fly|neon|upstash|vercel/postgres|planetscale|firebase|clerk|auth0|turso|convex" package.json apps packages scripts docker --glob '!**/node_modules/**'`.

### 7. Wrong vs Correct

#### Wrong

```yaml
services:
  app:
    ports:
      - "3000:3000"
```

#### Correct

```yaml
services:
  app:
    expose:
      - "3000"
  caddy:
    ports:
      - "${CADDY_HTTP_PORT:-8080}:80"
```
