# AgentHub 本地环境依赖

本目录放项目级环境依赖。P0 端到端验收默认使用 Docker Postgres，避免依赖远端 Postgres 控制台或手工数据库。

## P0 测试数据库

启动 Postgres：

```bash
pnpm env:p0:db:up
```

连接串：

```bash
DATABASE_URL=postgresql://agenthub:agenthub_dev@localhost:5432/agenthub_p0_test
```

初始化 schema 并生成 Auth.js 测试 session：

```bash
pnpm env:p0:seed
```

脚本会写入 `docker/.p0-test.env`，内容包含：

- `DATABASE_URL`
- `AUTH_TRUST_HOST=true`
- `AUTH_SECRET`
- `TEST_USER_ID`
- `TEST_GITHUB_ACCOUNT_ID`
- `TEST_AUTH_SESSION_TOKEN`
- `TEST_AUTH_COOKIE`

运行 W1 真实 API smoke 前，先启动 Web：

```bash
set -a
. docker/.p0-test.env
set +a
pnpm dev:web
```

另开终端运行：

```bash
pnpm env:p0:smoke
```

## pgAdmin

需要图形化查看数据库时启动：

```bash
docker compose -f docker/docker-compose.p0-test.yml --profile tools up -d
```

访问 `http://localhost:5050`，默认账号：

- 邮箱：`pgadmin@agenthub.local`
- 密码：`admin`

## 清理

停止容器：

```bash
pnpm env:p0:db:down
```

删除测试数据卷：

```bash
docker compose -f docker/docker-compose.p0-test.yml down -v
```

## 规则

- P0 主链路禁止 mock Workspace、Session、Message、Device API。
- 测试账号必须 seed 为 Auth.js database 用户：`user`、`account(provider='github')`、`session` 三张表都要有记录。
- API smoke 和 E2E 必须带真实 Auth.js database session cookie 访问真实 API，不能用 `X-Test-User-Id` 绕过 `auth()`。
- 本地 Postgres 路径不启用 Postgres RLS；权限边界由 API 的 `requireAuth()` 和 owner/session 查询验证。
