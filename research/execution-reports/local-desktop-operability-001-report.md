# LOCAL-DESKTOP-OPERABILITY-001 执行报告

## 范围

- 修复 `/api/plans` 加载失败：移除嵌套 `select('*, plan_nodes(*)')`，改为分别查询 `plans` 和 `plan_nodes`。
- 建立 Local Desktop Workspace 只读/可操作合同：Desktop 离线、未绑定或 Runtime doctor 未通过时允许查看历史，禁止继续执行。
- Web 侧新增 runtime status、工作区列表入口、工作区内部只读 banner、输入区发送门禁和 `/api/chat` 409 阻断。
- Desktop 侧新增真实 Runtime doctor：Claude Code / Codex 状态来自 CLI 安装、版本和认证状态，不再 hardcode connected。
- 修复 Electron 发行包缺失 `@agenthub/shared/dist/index.cjs`：shared 同时产出 ESM/CJS，desktop build 先构建 shared。

## Runtime Doctor 命令

- Claude Code：`command -v claude`、`claude --version`、`claude auth status --json`；登录引导 `claude auth login`。
- Codex：`command -v codex`、`codex --version`、`codex login status`；登录引导 `codex login`；完整诊断入口 `codex doctor --json`。
- macOS Electron 发行包通过用户登录 shell 解析 CLI 路径，避免 Finder 启动时默认 PATH 找不到 nvm/npm 安装的 CLI。

## 验证

- `pnpm --filter @agenthub/web build` 通过。
- `pnpm --filter @agenthub/web type-check` 通过。
- `DATABASE_URL=postgresql://test pnpm exec vitest run apps/web/__tests__/api/chat.test.ts apps/web/__tests__/api/workspaces.test.ts` 通过，23 tests。
- `pnpm --filter @agenthub/desktop type-check` 通过。
- `pnpm --filter @agenthub/desktop test -- --run` 通过，3 files / 8 tests。
- `pnpm --filter @agenthub/desktop build` 通过。
- `pnpm --filter @agenthub/desktop dist:mac` 通过。
- `app.asar` 检查包含 `/node_modules/@agenthub/shared/dist/index.cjs`。

## 残留风险

- P0 已覆盖安装、版本、认证与只读阻断；provider 级完整网络健康检查暂不作为可操作门禁，避免 `codex doctor --json` 中非认证类失败误判未登录。
- provider-specific native session resume/continue 仍未实现，本阶段只做状态真实性、只读/可操作入口和阻断语义。
