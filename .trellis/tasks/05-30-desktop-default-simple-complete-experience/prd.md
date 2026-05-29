# 修复桌面默认启动简易完整体验

## Goal

让 `pnpm dev:desktop` 默认启动时可以进入一个可用的本地开发体验：Desktop renderer 即使在浏览器 5173 直接打开也不崩，Web 端可以读取已有本地 P0 DB 环境，开发 HMR websocket 不报连接失败，PWA manifest 图标不 404。

补充 release 验证形态：Web/Mobile 由同一个 Web 服务端提供页面和 API；Desktop 打包为独立 Electron 客户端，连接该服务端，并通过 `agenthub://` 完成登录回跳。

## What I Already Know

* 用户反馈 `RuntimeDetection.tsx:15` 读取 `window.electronAPI.runtime` 时为空，导致 5173 默认页面报错。
* 用户反馈 Next HMR websocket `ws://localhost:3000/_next/webpack-hmr` 连接失败。
* 用户反馈 `icon-192.png` 404，manifest 图标不可用。
* 用户反馈 `/api/workspaces` 因未配置 `DATABASE_URL` 返回 500。
* 项目治理要求主链路 Workspace/Session/Message/User/Account 不能用内存 mock 假装成功。
* 仓库已有真实 Postgres P0 fixture/seed 流程：`docker/docker-compose.p0-test.yml`、`pnpm env:p0:seed:fixture`、`docker/.p0-test.env`。

## Assumptions

* 本任务不引入 mock workspace/session/message。
* “简易版完全体”本轮定义为默认开发入口尽量自动读取已有本地 P0 环境；如果本机尚未启动/seed 数据库，仍明确提示真实 DB 配置路径。
* 本轮不重做完整 auth/session 体验，只修启动期阻断和噪音错误。

## Requirements

* Desktop runtime detection 在 `window.electronAPI`、`runtime` 或 `detect` 缺失时不抛异常，显示清晰的非 Electron/预加载不可用状态。
* Runtime detection 调用失败时必须恢复 loading 状态，并给用户可重试的错误态。
* Web dev custom server 必须处理 Next dev websocket upgrade，避免 `_next/webpack-hmr` 连接失败。
* Web server 启动时必须在不覆盖显式环境变量的前提下读取本地 dev env 文件，包含 `docker/.p0-test.env`。
* PWA manifest 引用的 `icon-192.png` 和 `icon-512.png` 必须存在且是有效 PNG。
* Desktop 开发 renderer 从 `localhost:5173` 调用设备登录 API 时不得被 CORS 阻断。
* Desktop 登录完成后的 `agenthub://auth/bind` deep link 必须回到已有 Electron dev 实例，不应打开第二个 Electron 窗口。
* Desktop release 必须能生成 macOS `.app`，并在 Info.plist 声明 `agenthub://` URL scheme。
* 不允许用内存 mock 数据绕过真实数据库/API/session 合同。

## Acceptance Criteria

* [x] `pnpm --filter @agenthub/desktop type-check` 通过。
* [x] `pnpm --filter @agenthub/web type-check` 通过。
* [x] `RuntimeDetection` 在无 Electron preload 的浏览器环境不会抛 `Cannot read properties of undefined`。
* [x] Web custom server 对 Next HMR upgrade 有显式转发。
* [x] `apps/web/public/icon-192.png` 与 `apps/web/public/icon-512.png` 存在。
* [x] `/api/workspaces` 未配置 DB 时仍不返回假 workspace；存在本地 P0 env 时可读取真实 `DATABASE_URL`。
* [x] `/api/devices/login-intent` 与 `/api/devices/bind-status` 允许 `http://localhost:5173` 开发来源访问。
* [x] Electron main 使用 single-instance lock 处理 `agenthub://auth/bind`，第二实例参数会转发到已有窗口。
* [x] `pnpm --filter @agenthub/desktop dist:mac` 生成 `apps/desktop/release/mac-arm64/AgentHub.app`。
* [x] `AgentHub.app/Contents/Info.plist` 包含 `CFBundleURLSchemes = ["agenthub"]`。
* [x] `pnpm --filter @agenthub/web build` 通过，Web/Mobile 页面与 API 服务端可一起发布。

## Out of Scope

* 不实现 SQLite/PGLite 新数据库后端。
* 不绕过 Auth.js 或真实数据库权限模型。
* 不实现完整生产级首次启动向导。

## Technical Notes

* 相关文件：`apps/desktop/src/renderer/components/console/RuntimeDetection.tsx`、`apps/desktop/src/renderer/components/RuntimeConfigPage.tsx`、`apps/desktop/src/renderer/components/RuntimeStatus.tsx`。
* 相关文件：`apps/web/server.ts`、`apps/web/public/manifest.json`、`apps/web/app/api/workspaces/route.ts`。
* 相关规范：`.trellis/spec/frontend/index.md`、`.trellis/spec/backend/database-guidelines.md`、`.trellis/spec/guides/end-to-end-contract-planning.md`。
