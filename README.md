# AgentHub

## 安装

```bash
pnpm install
```

## 本地验收环境

一键准备本地验收 Postgres、Redis 和 Auth.js 测试 session：

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

验收 E2E 使用串行 worker，避免共享 Auth.js 测试用户并发改同一套 DB 状态：

```bash
pnpm test:e2e:acceptance
```

停止验收容器：

```bash
pnpm env:acceptance:down
```

更多数据库说明见 `docker/README.md`。

## Dev 开发

只启动 Web / 手机端 PWA：

```bash
pnpm dev:web
```

访问：

```text
http://localhost:3000
```

同时启动 Web 后端和 Electron 桌面端：

```bash
pnpm dev:desktop
```

桌面端开发渲染页默认是：

```text
http://localhost:5173
```

单独启动桌面端开发应用：

```bash
pnpm --filter @agenthub/desktop dev:app
```

## Release 构建

构建 Web：

```bash
pnpm release:web
```

构建 macOS 桌面端目录版：

```bash
pnpm release:desktop:mac
```

一次性构建 Web 和 macOS 桌面端：

```bash
pnpm release:local
```

macOS 桌面端产物位置：

```text
apps/desktop/release/mac-arm64/AgentHub.app
```

构建 macOS DMG：

```bash
pnpm --filter @agenthub/desktop dist:mac:dmg
```

## 检查和测试

类型检查：

```bash
pnpm type-check
```

Lint：

```bash
pnpm lint
```

单元测试：

```bash
pnpm test
```

E2E：

```bash
pnpm test:e2e
```

桌面端 E2E：

```bash
pnpm test:e2e:desktop
```

验收 API smoke：

```bash
pnpm env:acceptance:smoke
```
