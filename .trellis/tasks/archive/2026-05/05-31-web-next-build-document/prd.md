# Fix web Next production build missing document

## Goal

修复 `@agenthub/web` 生产构建在 `next build` 末尾报 `Cannot find module for page: /_document` 的问题，保证 P0 本地数据库 seed 后 Web 可以完成 build 并进入 production start。

## What I Already Know

* 用户复现命令为 `pnpm env:p0:db:up && pnpm env:p0:seed:fixture && pnpm --filter @agenthub/web build && pnpm --filter @agenthub/web start`。
* 数据库容器和 seed 已成功，失败发生在 `apps/web` 的 `next build` 阶段。
* 构建日志显示编译、lint、type validity 均通过，随后抛出 `PageNotFoundError: Cannot find module for page: /_document`。
* `apps/web` 使用 Next.js 15.5.18，脚本为 `"build": "next build"`，`"start": "NODE_ENV=production tsx server.ts"`。
* 当前 `apps/web` 是 App Router 结构，存在 `app/layout.tsx`，未发现 `pages/_document.*`。
* 工作区已有用户/历史脏改动集中在 `e2e/` 测试文件，本任务默认不触碰这些文件。

## Assumptions

* 这是构建/runtime 配置或 Next 页面解析兼容性问题，不需要改动业务用户链路。
* 修复应尽量局限在 `apps/web`，不引入新依赖。
* 生产启动只需验证服务可准备启动；若端口或长驻进程限制阻塞，可用 build/type-check 作为主要门禁并说明。

## Requirements

* 复现或等价触发当前 `@agenthub/web build` 失败。
* 找到 `/_document` 解析失败的实际触发点。
* 修改最小必要文件，让 `pnpm --filter @agenthub/web build` 通过。
* 不回滚或覆盖已有 `e2e/` 脏改动。

## Acceptance Criteria

* [x] `pnpm --filter @agenthub/web build` 成功。
* [x] 如修复影响生产启动路径，验证 `pnpm --filter @agenthub/web start` 至少能完成 Next prepare 并监听端口。
* [x] 说明根因、改动范围和未处理的既有脏文件。

## Definition of Done

* 读取相关 Trellis frontend/cross-layer 规范后再改代码。
* 运行必要的 lint/type/build 或等价质量门禁。
* 若发现可复用工程规则，更新 `.trellis/spec/`；若没有，明确无需更新。

## Out of Scope

* 不清理 Docker orphan container。
* 不修复已有 E2E 测试脏改动。
* 不调整产品 UI、数据库 schema、认证流程或 runtime 业务逻辑。

## Technical Notes

* 相关文件初步包括 `apps/web/next.config.ts`、`apps/web/server.ts`、`apps/web/app/layout.tsx` 和可能的 Next 构建产物。
* 相关规范索引：`.trellis/spec/frontend/index.md`、`.trellis/spec/cross-layer/index.md`。
* 复查时直接运行 `pnpm --filter @agenthub/web build` 已成功；随后重新运行 `pnpm env:p0:db:up && pnpm env:p0:seed:fixture && pnpm --filter @agenthub/web build` 仍成功。
* 使用 `PORT=3100 pnpm --filter @agenthub/web start` 验证 production server 可完成 Next prepare 并监听端口，验证后已停止进程。
* 当前无法稳定复现原始 `/_document` 错误。代码仓库是 App Router 结构，未发现业务代码引用 `pages/_document` 或 `next/document`；本次不做无证据配置修改。
* 构建仍会输出两个非阻塞 warning：ESLint 未检测到 Next.js plugin，以及根 `package.json` 未声明 `"type": "module"` 导致 `eslint.config.js` 被重新解析为 ESM。
