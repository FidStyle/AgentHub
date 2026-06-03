# 并行 Worktree 测试端口规范

> 多功能线并行开发时，任何 dev server、预览服务、E2E webServer、runtime worker 或本地回调服务都必须显式指定端口，不能依赖框架默认端口或自动递增端口。

## Scenario: Parallel Worktree Test Ports

### 1. Scope / Trigger

- Trigger: 在多个 Git worktree/lane 并行运行 `pnpm dev`、`next dev`、Playwright、OpenCLI UAT、Docker app、runtime worker 或任何需要监听本地端口的验收命令。
- Applies to: `deploy-v1`、`mini-ide`、`rich-artifacts`、`chat-polish`、`orchestrator-spike` 以及后续新增 lane。
- Problem prevented: 多个窗口抢占 `3000`、`3001`、`5173` 等默认端口，导致测试连到错误 worktree、服务启动失败、截图来自旧页面或 E2E 假绿。

### 2. Signatures

每个 lane 启动可访问服务时，必须显式传入以下字段中的相关项：

```bash
PORT=<unique-port>
HOST=127.0.0.1
BASE_URL=http://127.0.0.1:<unique-port>
NEXT_PUBLIC_APP_URL=http://127.0.0.1:<unique-port>
PLAYWRIGHT_BASE_URL=http://127.0.0.1:<unique-port>
```

Playwright webServer 配置必须绑定同一 `PORT` / `url`：

```typescript
webServer: {
  command: 'PORT=3102 HOST=127.0.0.1 pnpm dev',
  url: 'http://127.0.0.1:3102',
  reuseExistingServer: false,
}
```

推荐端口分配：

| Lane | Branch / Worktree | Web port | Notes |
| --- | --- | ---: | --- |
| main/control | `AgentHub_new_claude_test` | 3000 | 总控通常不跑业务服务；如必须跑，显式使用 `3000` |
| deploy-v1 | `feature/deploy-v1` | 3101 | Docker/Caddy 内部端口也要写入报告 |
| mini-ide | `feature/mini-ide-agentic-edit` | 3102 | IDE/workbench UI 与 Playwright 使用同一 base URL |
| rich-artifacts | `feature/rich-doc-ppt-artifacts` | 3103 | 预览/导出服务如另起端口需单独记录 |
| chat-polish | `feature/chat-im-polish` | 3104 | IM 表面回归必须断言当前端口页面 |
| orchestrator-spike | `spike/orchestrator-execution-model` | 3105 | 调研/spike 不应占用其他 lane 端口 |

### 3. Contracts

- 启动命令、E2E 命令、验收报告必须写出实际端口和 base URL。
- 禁止直接运行依赖默认端口的命令后宣称通过，例如裸 `pnpm dev`、裸 `next dev`、裸 `playwright test` 且未声明 base URL。
- 禁止使用框架自动递增端口作为通过证据。若 `3000` 被占用后服务自动跑到 `3001`，测试报告必须标记为配置错误并重跑。
- 同一 lane 内如果需要多个服务，必须为每个服务声明唯一端口和用途，例如 `WEB_PORT=3102`、`PREVIEW_PORT=3202`、`WORKER_HEALTH_PORT=3302`。
- 如果端口已被占用，先识别占用者；只能选择一个新的显式端口，并在报告中说明替代端口，不能让工具自动猜。
- 总控窗口在合并或验收多个 lane 前，必须检查各 lane 报告中的端口互不冲突。

### 4. Validation & Error Matrix

| 条件 | 必须结果 | 禁止结果 |
| --- | --- | --- |
| 默认端口已被其他 lane 占用 | 失败并要求显式换端口重跑 | 框架自动递增端口后继续验收 |
| Playwright 连接到非本 lane URL | 测试失败，报告为环境配置错误 | 用旧页面截图宣称当前 lane 通过 |
| dev server 命令未声明 `PORT` | 不接受为并行验收证据 | 报告“本地跑通” |
| `BASE_URL` 与 `PORT` 不一致 | 测试失败 | 静默使用默认 URL |
| Docker/Caddy 端口与 Web 端口冲突 | 调整显式端口并记录 | 复用默认端口导致其中一个服务不可达 |

### 5. Good/Base/Bad Cases

- Good: `mini-ide` 使用 `PORT=3102 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3102 pnpm test:e2e`，报告记录 URL、exit code、截图路径和当前 worktree branch。
- Base: `orchestrator-spike` 只做代码阅读和调研，不启动服务；报告写明未占用端口。
- Bad: `chat-polish` 直接运行 `pnpm dev`，Next 自动从 `3000` 跳到 `3001`，随后 Playwright 仍访问 `http://localhost:3000` 并截图。

### 6. Tests Required

- 启动前断言：报告中列出 lane、worktree path、branch、`PORT`、`BASE_URL`。
- 服务断言：测试访问的 URL 必须包含该 lane 显式端口。
- 视觉/E2E 断言：截图、trace 或 OpenCLI 证据必须能对应到同一 `BASE_URL`。
- 并行验收断言：总控合并前检查所有 lane 的端口表，不允许两个活跃 lane 共用同一本地端口。
- 失败断言：出现端口冲突、自动递增端口或 URL 不一致时，必须重跑；不能把该轮计入 passed。

### 7. Wrong vs Correct

#### Wrong

```bash
pnpm dev
npx playwright test
```

问题：默认端口可能被其他 worktree 占用，Playwright 可能访问错误服务。

#### Correct

```bash
PORT=3104 HOST=127.0.0.1 pnpm dev
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3104 npx playwright test
```

报告必须写明：

```text
lane=chat-polish
worktree=/Users/joytion/Documents/code/agenthub-worktrees/chat-polish
branch=feature/chat-im-polish
baseUrl=http://127.0.0.1:3104
result=passed
```
