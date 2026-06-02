# AgentHub 本地环境依赖

本目录放项目级环境依赖。端到端验收默认使用 Docker Postgres，避免依赖远端 Postgres 控制台或手工数据库。

## 验收测试环境

推荐验收入口：

```bash
pnpm env:acceptance:up
pnpm dev:acceptance
```

`env:acceptance:up` 会启动 Postgres、Redis，并显式创建本地 fixture Auth session；`dev:acceptance` 会在同一套环境下启动 Web server 和本地 runtime worker，默认使用 `RUNTIME_EXECUTOR=real`。机器上需要已安装并登录 Claude Code / Codex CLI；角色会按自己的 `runtime_type` 选择对应 CLI，不会在不可用时切换到另一个 CLI。

Web 与 worker 运行后，另开终端执行 smoke：

```bash
pnpm env:acceptance:smoke
```

清理验收容器：

```bash
pnpm env:acceptance:down
```

主环境文件只使用 `docker/.acceptance.env`；脚本不读取其他验收 env fallback。

以下命令保留用于分步调试。

启动 Postgres：

```bash
pnpm env:acceptance:db:up
```

连接串：

```bash
DATABASE_URL=postgresql://agenthub:agenthub_dev@localhost:5432/agenthub_acceptance
```

初始化 schema，并基于数据库里已有的 GitHub 关联测试用户生成 Auth.js 测试 session：

```bash
pnpm env:acceptance:seed
```

默认模式不会创建用户。脚本会按以下优先级查找已有 GitHub 关联用户：

1. `TEST_GITHUB_ACCOUNT_ID` 指定的 `account(provider='github', providerAccountId=...)`
2. `TEST_USER_EMAIL` 指定的用户邮箱，且该用户已有 GitHub account 关联
3. 任意已有 `account.provider='github'` 的用户

默认模式会排除内置 bootstrap fixture（`00000000-0000-4000-8000-000000000001` / `agenthub-acceptance-github`），避免把本地合成账号误当成真实 GitHub 链接测试用户。

如果空库需要 bootstrap 一个本地 fixture，必须显式启用：

```bash
ACCEPTANCE_CREATE_GITHUB_FIXTURE=true pnpm env:acceptance:seed
# 等价短命令
pnpm env:acceptance:seed:fixture
```

脚本会写入 `docker/.acceptance.env`，内容包含：

- `DATABASE_URL`
- `AUTH_TRUST_HOST=true`
- `AUTH_SECRET`
- `TEST_USER_ID`
- `TEST_USER_EMAIL`
- `TEST_GITHUB_ACCOUNT_ID`
- `TEST_AUTH_SESSION_TOKEN`
- `TEST_AUTH_COOKIE`

运行 W1 真实 API smoke 前，先启动 Web：

```bash
set -a
. docker/.acceptance.env
set +a
pnpm dev:web
```

另开终端运行：

```bash
pnpm env:acceptance:smoke
```

验收 E2E 使用串行 worker：

```bash
pnpm test:e2e:acceptance
```

普通 `pnpm test:e2e` 仍可用于本地开发调试；风险点不是 CLI 不能并行，而是共享 Auth.js 测试用户的 DB 变更型 spec 在多 worker 下会同时创建/选择/删除同一用户下的 workspace/session，不能作为 P0 验收通过证据。

## pgAdmin

需要图形化查看数据库时启动：

```bash
docker compose -p agenthub_acceptance -f docker/docker-compose.acceptance.yml --profile tools up -d
```

访问 `http://localhost:5050`，默认账号：

- 邮箱：`pgadmin@agenthub.local`
- 密码：`admin`

## 清理

停止容器：

```bash
pnpm env:acceptance:db:down
```

删除测试数据卷：

```bash
docker compose -p agenthub_acceptance -f docker/docker-compose.acceptance.yml down -v
```

## 规则

- 主链路禁止 mock Workspace、Session、Message、Device API。
- 默认测试账号必须是数据库里已有的 Auth.js database 用户，且 `account(provider='github')` 已关联；seed 脚本只为该用户创建测试 session。
- 只有 `ACCEPTANCE_CREATE_GITHUB_FIXTURE=true` 或 `pnpm env:acceptance:seed:fixture` 时才允许为本地空库创建 fixture 用户和测试 GitHub account。
- E2E 自动化使用 fixture seed；它验证 Auth.js database session、API 权限和真实 DB 持久化，不代表已完成真实 GitHub OAuth 浏览器登录。
- API smoke 和 E2E 必须带真实 Auth.js database session cookie 访问真实 API，不能用 `X-Test-User-Id` 绕过 `auth()`。
- 本地 Postgres 路径不启用 Postgres RLS；权限边界由 API 的 `requireAuth()` 和 owner/session 查询验证。
