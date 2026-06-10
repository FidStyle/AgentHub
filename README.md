# AgentHub

AgentHub 是一个以 IM 对话为入口的多 Agent 协作平台。Web 负责完整工作台，Mobile `/m` 负责轻量对话、审批和预览，Desktop 负责本地 Connector 与 Claude Code/Codex 等本地 Runtime 转发。

## Prerequisites

| 依赖 | 用途 |
| --- | --- |
| Node.js 20+ | 推荐本地开发运行时 |
| pnpm 9.15.0 | workspace 包管理，版本来自 `package.json` |
| Docker / Docker Compose | 本地 Postgres、Redis、验收环境、自托管部署 |
| Playwright 浏览器 | Web/Mobile/Desktop E2E |
| GitHub OAuth App | 正常登录链路 |
| Claude Code / Codex CLI | 本地或真实 Runtime 验收 |
| LibreOffice `soffice` 或 PPT 转换命令 | 可选；用于 PPTX 转 PDF/浏览器预览，没有时回退下载/摘要 |

安装依赖：

```bash
pnpm install
```

安装 Playwright 浏览器：

```bash
pnpm exec playwright install
```

## Dev 启动

| 端 | 命令 | 访问/说明 |
| --- | --- | --- |
| Web | `pnpm dev:web` | `http://localhost:3000` |
| Mobile `/m` | `pnpm dev:web` | `http://localhost:3000/m` |
| Desktop + Web | `pnpm dev:desktop` | 同时启动 Web 和 Electron |
| Desktop app only | `pnpm --filter @agenthub/desktop dev:app` | 需要 Web 后端已可访问 |
| Web + Redis runtime | `pnpm dev:full` | 启动 Redis/worker 后运行 Web |

Desktop 负责本地 Connector 能力。角色、会话、权限和产物状态仍由 Web/Server 保存。

## 本地验收环境

一键准备 Postgres、Redis 和 Auth.js 测试 session：

```bash
pnpm env:acceptance:up
```

启动 Web 和 runtime worker：

```bash
pnpm dev:acceptance
```

API smoke：

```bash
pnpm env:acceptance:smoke
```

验收 E2E：

```bash
pnpm test:e2e:acceptance
```

Runtime 验收子集：

```bash
pnpm test:e2e:acceptance:runtime
```

停止验收容器：

```bash
pnpm env:acceptance:down
```

## 检查和测试

| 类型 | 命令 |
| --- | --- |
| Type check | `pnpm type-check` |
| Lint | `pnpm lint` |
| Unit tests | `pnpm test` |
| Web/Mobile E2E | `pnpm test:e2e` |
| Desktop E2E | `pnpm test:e2e:desktop` |

## Release

| 目标 | 命令 | 产物/说明 |
| --- | --- | --- |
| Web build | `pnpm release:web` | Next.js Web 构建 |
| macOS Desktop | `pnpm release:desktop:mac` | `apps/desktop/release/mac-arm64/AgentHub.app` |
| Web + macOS Desktop | `pnpm release:local` | 本地完整 release |
| macOS DMG | `pnpm --filter @agenthub/desktop dist:mac:dmg` | DMG 安装包 |

## 自托管部署

检查 Compose 配置：

```bash
AUTH_SECRET=replace-me NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<base64-32-byte-key> pnpm deploy:self-hosted:config
```

构建并 stage Web：

```bash
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<base64-32-byte-key> pnpm deploy:web:stage
```

启动 Docker + Caddy 自托管栈：

```bash
AUTH_SECRET=replace-me NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<same-key-as-stage> docker compose -p agenthub_deploy -f docker/docker-compose.deploy.yml up -d --build
```

默认入口：`http://localhost:8080`。生产环境还需要配置真实 `APP_BASE_URL`、`AUTH_URL`/`NEXTAUTH_URL`、`AUTH_GITHUB_ID` 和 `AUTH_GITHUB_SECRET`。
