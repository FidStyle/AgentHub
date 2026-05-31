# 验收硬化 2：真实环境一键启动与配置

## Goal

提供可复现的一键本地验收环境，避免验收时靠手工拼环境或隐式 `.env`。

## Shared Contract

- `research/contracts/ACCEPTANCE-HARDENING-2026-06-01.md`

## Requirements

- 一键启动 Postgres、Redis、seed、Auth session、Web server、runtime worker。
- 一键 smoke 覆盖 DB/Auth/API/runtime 基础连通。
- `.env.local.example`、docker env、README 或脚本必须一致。
- 默认环境不得指向不可用占位符后仍宣称产品可用。
- worker 使用真实 executor 或明确测试 executor；两者不得混淆。

## Acceptance Criteria

- [ ] 干净环境可按文档/脚本启动。
- [ ] smoke 命令 exit 0。
- [ ] 缺配置时用户看到明确中文错误，不是假成功。
- [ ] 验收报告记录命令和输出摘要。

## Likely Starting Evidence

- `package.json`
- `docker/.p0-test.env`
- `docker/docker-compose.p0-test.yml`
- `docker/docker-compose.runtime.yml`
- `apps/web/scripts/setup-p0-test-db.ts`
- `apps/web/scripts/verify-p0-api-crud.ts`
- `e2e/global-setup.ts`
