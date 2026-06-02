# 本地 Runtime 凭证边界

## 场景：本地 Claude Code / Codex 只检测不托管密钥

### 1. 范围与触发条件

- 触发条件：`FR-AGENT-001`、`FR-RUNTIME-001`、`NFR-SEC-002` 明确本地 Claude Code / Codex 是用户本机原生 CLI Runtime，不是 AgentHub 托管的模型 API Provider。
- 适用范围：Web Agent 配置页、Desktop Connector、Runtime Detector、Runtime Binding API、Runtime Adapter、共享类型与自动化测试。
- 参考事实：AionUi 将“本地 Agents”做成本地安装后自动识别，同时把模型 API Key 放在模型供应商配置；codeg 也把 Model Provider 与 ACP Agent 设置拆开。AgentHub P0 采用同样边界。

### 2. 签名

```typescript
type RuntimeKind = 'hosted' | 'claude_code' | 'codex';
type ExecutionDomain = 'cloud' | 'local_desktop';
type RuntimeEndpointKind = 'public_cloud' | 'user_local';
type RuntimeAuthStatus = 'unknown' | 'authenticated' | 'auth_required' | 'unavailable';

interface RuntimeDetectionResult {
  runtimeKind: RuntimeKind;
  executionDomain: ExecutionDomain;
  installed: boolean;
  cliPath?: string;
  version?: string;
  authStatus: RuntimeAuthStatus;
  capabilities: RuntimeCapabilities;
  diagnosticCode?: RuntimeErrorCode;
  diagnosticMessage?: string;
}

interface RuntimeBinding {
  workspaceId: string;
  roleAgentId: string;
  runtimeKind: RuntimeKind;
  executionDomain: ExecutionDomain;
  endpointKind: RuntimeEndpointKind;
  detectionSnapshot: RuntimeDetectionResult;
}

interface RoleAgentRuntimeSelection {
  roleAgentId: string;
  runtimeType: 'claude_code' | 'codex';
}
```

### 3. 契约

- 本地 `claude_code` / `codex` 绑定只允许保存 `runtimeKind`、`executionDomain`、`cliPath`、`version`、`authStatus`、`capabilities`、诊断码和 native session 绑定。
- 本地 `claude_code` / `codex` 绑定属于 `user_local` endpoint。远端 Web/Mobile 只能通过 Cloud Runtime Gateway + Desktop DeviceChannel/tunnel 访问它，不能保存或访问用户本机 IP/端口。
- 禁止在本地 Runtime 绑定、Role Agent 配置、Workspace、Session、Message、Runtime Event 中保存原始 `ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`GEMINI_API_KEY`、`*_BASE_URL` 或等价密钥/中转地址。
- Web 配置页只能展示检测状态、版本、登录状态、能力声明、修复引导和 Runtime 选择。P0 不做 App 内代登录、设备码轮询或 OAuth 代理。
- Role Agent 的 Claude Code / Codex 选择保存为 `role_agents.runtime_type`。不得把 `runtime:codex` / `runtime:claude_code` 塞进 `capabilities` 来驱动执行。
- Desktop Connector 可以继承当前进程环境执行用户本机 CLI，但不得把敏感环境变量回传到 Web 或后端。
- 平台托管 Runtime 或模型 Provider 如需 API Key，必须走单独凭证/模型供应商能力，并且不能复用本地 CLI Runtime Binding 数据结构。
- AgentHub 自己创建的运行目录、云端工作区、临时文件和日志默认必须放在用户级 `~/.agenthub/` 下；禁止默认落到当前产品仓库的 `process.cwd()/.agenthub`。测试、CI 或部署可以通过显式环境变量覆盖目录，例如 `AGENTHUB_CLOUD_WORKSPACE_ROOT`。
- AgentHub Web/App 中的 IM 对话不应自动同步到 Claude Code/Codex 的本地 resume 会话。需要连续上下文时，只允许通过明确的 AgentHub session/runtime binding、native session id 或任务摘要注入完成，不能把整段 Web 消息流隐式写入本地 CLI 原生会话。

### 4. 校验与错误矩阵

| 条件 | 错误或状态 |
| --- | --- |
| Web/API 提交本地 `claude_code` / `codex` 绑定时携带 `apiKey`、`env`、`baseUrl` | 拒绝保存，返回 `SECRET_FIELD_NOT_ALLOWED` |
| Desktop 未检测到 CLI | `RUNTIME_NOT_FOUND`，`installed=false` |
| CLI 存在但未登录或调用返回认证失败 | `RUNTIME_AUTH_REQUIRED`，`authStatus='auth_required'` |
| 用户点击未登录 Runtime 的修复入口 | 展示本机命令/文档引导，不启动 App 内登录代理 |
| Workspace 是 `cloud` 但绑定本地 Runtime | `EXECUTION_DOMAIN_MISMATCH` |
| Workspace 是 `local_desktop` 但 Desktop Connector 离线 | `DEVICE_OFFLINE` |
| Web/Mobile 试图提交用户本机 IP/端口作为 runtime endpoint | `LOCAL_ENDPOINT_DIRECT_ACCESS_FORBIDDEN` |
| Runtime 执行事件包含疑似密钥值 | 写入前脱敏，测试中断言不落库 |

### 5. 正常/基线/错误用例

- 正常：用户在本机完成 `claude login` 或 `codex login` 后，Desktop 检测到 `authenticated`，Web 只显示“已登录、版本、能力”，Role Agent 绑定该 Runtime。
- 基线：用户没有安装 Codex，Web 显示“未检测到 Codex CLI”和安装指引，不出现 API Key 输入框。
- 错误：Agent 配置页出现“自定义 API Key”字段，并把 `OPENAI_API_KEY` 保存到 `runtime_bindings` 或 `runtime-config.json` 作为默认 P0 路径。

### 6. 必需测试

- 单元测试：`assertRuntimeBindingAllowed` 拒绝本地 Runtime 绑定中的 `apiKey`、`env`、`baseUrl` 字段。
- Desktop 单元测试：Runtime Detector 将 CLI not found、auth required、authenticated 映射到稳定诊断码。
- API 集成测试：创建/更新 Role Agent Runtime Binding 时，Cloud/Local 执行域不匹配被拒绝，敏感字段被拒绝。
- 前端组件测试：本地 Claude Code / Codex 配置页只渲染检测、绑定、诊断和引导控件，不渲染 API Key 输入框，也不渲染“在 App 内登录/授权”按钮。
- E2E：本地 Runtime 未登录时，用户不能启动执行；完成本机登录并重新检测后，可以绑定并发起 Runtime 请求。

### 7. 错误与正确示例

#### 错误

```typescript
await saveRuntimeBinding({
  workspaceId,
  roleAgentId,
  runtimeKind: 'codex',
  executionDomain: 'local_desktop',
  endpointKind: 'user_local',
  env: {
    OPENAI_API_KEY: userInputApiKey,
    OPENAI_BASE_URL: userInputBaseUrl,
  },
});
```

#### 正确

```typescript
const detection = await desktopRuntimeDetector.detect('codex');

await saveRuntimeBinding({
  workspaceId,
  roleAgentId,
  runtimeKind: 'codex',
  executionDomain: 'local_desktop',
  endpointKind: 'user_local',
  detectionSnapshot: detection,
});
```

密钥属于用户本机 Codex/Claude 原生认证或独立模型 Provider，不属于本地 CLI Runtime Binding。

## 场景：Local Desktop Workspace 只读/可操作状态

### 1. 范围与触发条件

- 触发条件：Web、Desktop、Runtime Gateway 或 Workspace UI 需要判断 Local Desktop Workspace 是否能继续执行。
- 适用范围：`/api/runtime/status`、`/api/chat`、Web 工作区列表、Web 工作区输入区、Desktop Runtime Detector、DeviceChannel、runtime capability 回传。
- 核心规则：历史可查看不等于本地可执行。Web 服务器不能直接连接用户本机 Claude Code / Codex；可执行状态必须由 Desktop 在线和 Runtime doctor 共同证明。

### 2. 签名

```typescript
type WorkspaceBlockReason =
  | 'desktop_not_bound'
  | 'desktop_offline'
  | 'runtime_status_unknown'
  | 'runtime_missing'
  | 'runtime_auth_required'
  | 'native_session_unavailable';

interface WorkspaceOperabilityStatus {
  readOnlyAvailable: true;
  operable: boolean;
  blockReason: WorkspaceBlockReason | null;
  blockReasonText: string | null;
  desktop: {
    status: 'connected' | 'disconnected' | 'not_bound';
    connected: boolean;
  };
  runtime: {
    status: 'ready' | 'unavailable';
    doctorKnown: boolean;
    nativeSessionAvailable: boolean;
    nativeSessionDescription: string;
    description: string;
  };
}
```

### 3. 契约

- Cloud Workspace 不受 Desktop 状态影响。
- Local Desktop Workspace 在 Desktop 离线、未绑定、Runtime 未检测或 Runtime 未登录时，只能只读查看历史。
- Desktop native session resume/continue 使用官方 CLI 能力：Claude Code `--resume/--continue`，Codex `codex exec resume`；Web gateway 必须持久化并复用 `runtime_sessions.native_session_id`。
- 只读模式允许展示 AgentHub DB 中的消息、计划、产物和错误状态；禁止发送消息、恢复本地 session、执行 Action 或把失败包装成 agent 成功回复。
- Desktop Runtime doctor 必须检测 CLI 是否存在、版本、认证/可启动状态，并通过 DeviceChannel 回传 runtime capability snapshot。
- Desktop Runtime doctor 的 P0 基线命令必须使用真实 CLI 命令：
  - Claude Code：`command -v claude`、`claude --version`、`claude auth status --json`；认证引导为 `claude auth login`。
  - Codex：`command -v codex`、`codex --version`、`codex login status`；认证引导为 `codex login`；完整诊断入口为 `codex doctor --json`。
  - Codex 认证判定必须支持 `codex login status` 输出 `Logged in using an API key ...`，并用 `codex doctor --json` 的 `checks["auth.credentials"].status === "ok"` 作为兜底；`overallStatus=warning` 不应因为 terminal 等非认证警告误判“未登录”。
- macOS Electron 发行包从 Finder / Dock / 快捷方式启动时不一定继承交互终端的 PATH；本地 Runtime 检测应通过用户登录 shell、交互 shell 和常见安装目录解析 CLI 路径，不能只依赖 Electron 进程默认 PATH 或裸 `command -v`。
- 本地 Runtime 检测成功后应优先使用解析到的绝对 CLI 路径执行后续 `version`、`auth status`、`doctor` 和一次性消息命令，避免 Finder 启动时 `codex` / `claude` 在执行阶段再次找不到。
- 对 nvm/fnm/asdf 安装的 Node CLI，绝对 CLI 路径本身还不够；执行时必须把 CLI 所在 `bin` 目录 prepend 到命令 PATH，避免 shebang `/usr/bin/env node` 在 Finder/Dock 启动环境下找不到 `node`。
- Web/Mobile 只能通过 Cloud Runtime Gateway + Desktop DeviceChannel/tunnel 访问用户本机 Runtime，禁止直连本地 IP/端口。

### 4. 校验与错误矩阵

| 条件 | 状态或错误 |
| --- | --- |
| 用户未绑定 Desktop | `desktop_not_bound` |
| Desktop 已绑定但离线 | `desktop_offline` |
| Desktop 在线但没有 Runtime doctor snapshot | `runtime_status_unknown` |
| doctor 显示 CLI 不存在 | `runtime_missing` |
| doctor 显示 CLI 未登录或不可启动 | `runtime_auth_required` |
| runtime session 需要恢复但 CLI 不支持或未返回 native id | 明确 `runtime_failed`，不得伪造成成功续接 |
| Local Desktop Workspace 发消息但不可操作 | HTTP 409 + 中文阻塞原因 |

### 5. 正常/基线/错误用例

- 正常：Desktop 在线，Claude Code / Codex doctor 通过，Web 显示“可操作”，允许发送。
- 基线：Desktop 离线，Web 允许“查看历史”，输入框禁用并显示“本地 Desktop 未连接云端，只能查看历史”。
- 错误：Desktop 离线时 Web 仍显示“Runtime 可用”或发送后伪造 agent 回复。

### 6. 必需测试

- API 测试：`/api/runtime/status` 返回 `readOnlyAvailable`、`operable`、`blockReason`。
- API 测试：Local Desktop Workspace 不可操作时 `/api/chat` 返回 409，不写入假成功 agent reply。
- Web 测试：只读模式输入框和发送按钮禁用，刷新连接状态入口可见。
- Desktop 测试：Codex / Claude Code 卡片状态来自 Runtime doctor，不 hardcode connected。

### 7. 错误与正确示例

#### 错误

```typescript
const runtimeReady = desktopConnected;
```

#### 正确

```typescript
const runtimeReady =
  desktopConnected &&
  runtimeDoctor.known &&
  runtimeDoctor.runtimes.some(runtime =>
    runtime.available && runtime.authenticated && runtime.launchable,
  );
```

## 场景：Desktop 本地 Runtime 一次性消息与诊断

### 1. Scope / Trigger

- Trigger：Desktop 会话 UI 需要让用户验证本机 Claude Code / Codex 是否能启动，并允许 P0 级轻量消息发送。
- 适用范围：Desktop renderer 输入框、preload IPC、main runtime adapter、Runtime Detector、组件测试。
- 核心风险：用户输入不能被当成任意 shell 命令执行；否则 UI 语义不清，且失败时只暴露 `ENOENT`、`command not found` 等底层错误。

### 2. Signatures

```typescript
type RuntimePromptRequest = {
  runtimeType: 'claude_code' | 'codex';
  prompt: string;
};

type RuntimeExecResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
};
```

### 3. Contracts

- Renderer 输入框的语义是“发送给当前本地 Runtime 的消息”，不是 shell command；同一 runtime/cwd 的后续消息应复用官方 native session id。
- Renderer 只能提交 `RuntimePromptRequest`，不得提交任意 command 字符串。
- Main process 负责把 `runtimeType` 映射到固定 CLI 命令：
  - `codex` -> 新会话 `codex exec --skip-git-repo-check --sandbox read-only --color never --json --output-last-message "$AGENTHUB_OUTPUT_FILE" -- "$AGENTHUB_PROMPT"`；续接 `codex exec resume <session-id> "$AGENTHUB_PROMPT"` 或 `codex exec resume --last "$AGENTHUB_PROMPT"`。
  - `claude_code` -> 新会话 `claude --print --output-format json "$AGENTHUB_PROMPT"`；续接 `claude --print --output-format json --resume <session-id> "$AGENTHUB_PROMPT"` 或 `--continue`。
- Prompt 必须通过环境变量或等价安全参数传递，不能拼接进 shell 字符串。
- Codex stdout 是运行转录流，不是稳定的“最终回复”协议；main process 必须优先读取 `--output-last-message` 写入的文件作为用户可见回复，并只在该文件缺失时才从 stdout 兜底提取。
- Codex stdout 兜底提取必须剥离 `Reading additional input from stdin...`、版本横幅、`user`/`codex` 转录标签和 `tokens used` 尾部，避免 Desktop UI 把运行日志当成 Agent 回复。
- CLI 路径解析和执行应使用用户登录 shell，兼容 macOS Finder 启动的 Electron 进程 PATH 不完整问题。
- 本地 Runtime 消息必须有超时上限，超时后返回中文错误，不能让 UI 永久停留在“发送中”。
- Main process 应使用可取消的进程句柄执行 CLI，renderer 的“停止”按钮必须调用真实 cancel IPC，不能只是 disabled 占位。
- Desktop “最近会话”只展示本机 Runtime 会话型活动，例如 `[Codex] prompt` 或 `[Claude Code] prompt` 的消息记录；诊断、连接器启动和审批不应伪装成会话历史。完整 IM 历史、Artifact、Agents 和编排仍属于 Web 工作台。

### 4. Validation & Error Matrix

| 条件 | 行为 |
| --- | --- |
| prompt 为空 | 返回中文错误“请输入要发送给本地 Runtime 的消息” |
| Runtime type 不是 `codex` / `claude_code` | 返回中文错误“当前 Runtime 暂不支持” |
| 工作目录不存在 | 自动创建目录；创建失败才返回中文错误“无法创建工作目录：...” |
| CLI 未找到或 spawn `ENOENT` | 返回中文错误“未找到 Codex/Claude Code CLI，请先完成安装和诊断” |
| CLI 进程超时 | 返回中文错误“Codex/Claude Code 响应超时...” |
| Codex exitCode 为 0 且 `$AGENTHUB_OUTPUT_FILE` 有内容 | 返回该文件内容作为 stdout，不展示 Codex 横幅、stdin 提示或 tokens |
| Codex stdout 只有转录流、无输出文件 | 从最后一个 `codex` 回复块提取文本，剥离 `tokens used` 尾部 |
| CLI exitCode 非 0 | 活动列表显示失败、stderr/stdout 摘要和中文原因 |

### 5. Good/Base/Bad Cases

- Good：选中 Codex，输入“帮我解释当前目录”，Desktop 执行固定 `codex exec` 命令并显示真实输出。
- Base：选中 Claude Code，输入一次性 prompt，Desktop 执行 `claude --print` 并显示真实输出。
- Bad：输入 `ls -la` 后 Desktop 直接把它作为 shell command 执行，用户以为是在和 Agent 对话但实际进入任意命令执行器。
- Bad：Desktop 直接展示 Codex stdout 全量转录，导致用户看到 `Reading additional input from stdin...`、版本横幅、重复 prompt 和 `tokens used`。

### 6. Tests Required

- 单元测试：`RUNTIME_EXEC_COMMANDS.codex` 包含 `--output-last-message "$AGENTHUB_OUTPUT_FILE"`。
- 单元测试：Codex 输出清洗优先使用 output-last-message 文件内容。
- 单元测试：Codex stdout 兜底清洗会移除 stdin 提示和 `tokens used`，只返回最后一个 `codex` 回复块。
- 组件测试：Runtime exitCode 非 0 时，活动标题只显示 `[Agent] prompt`，失败原因单独显示，不能把同一段长输出在标题和原因里重复展示。
- 组件测试：诊断按钮点击后调用 `runtime.detect()` 并渲染活动。
- 组件测试：Codex 发送时 IPC payload 为 `{ runtimeType: 'codex', prompt }`。
- 组件测试：Claude Code 发送时 IPC payload 为 `{ runtimeType: 'claude_code', prompt }`。
- 组件测试：runtime bridge 缺失或 CLI 缺失时展示中文失败原因，不只展示 `ENOENT`。

### 7. Wrong vs Correct

#### Wrong

```typescript
const stdout = await runCodexExec(prompt)
return { stdout }

await runtime.execute(input.trim(), cwd)
```

#### Correct

```typescript
const outputFile = createTempOutputFile()
await runCodexExecWithOutputLastMessage(prompt, outputFile)
return {
  stdout: readFinalMessage(outputFile) || extractFinalCodexAnswer(stdout),
}

await runtime.execute({ runtimeType: 'codex', prompt: input.trim() }, cwd)
```

## 场景：Desktop / Electron 验收测试前进程隔离

### 1. Scope / Trigger

- Trigger：运行 Desktop、Electron、DeviceChannel、opencli 或本地 `local_desktop` 链路验收前，机器上可能残留旧的 Vite/Electron/Playwright/WebSocket 进程。
- 适用范围：`npx playwright test --config e2e/playwright.desktop.config.ts`、手工 Playwright Electron 脚本、`pnpm --filter @agenthub/desktop exec vite --port 5173`、`pnpm dev:acceptance`、opencli Desktop/Web UAT。
- 核心风险：旧进程占用 `5173` 或保留旧 renderer bundle、旧 DeviceChannel token、旧 WebSocket CONNECTING 状态，导致测试看似是当前代码失败，实际是旧进程污染。

### 2. Signatures

```bash
# Desktop/Electron 测试前清理命令。只清理 AgentHub 当前仓库相关进程。
pkill -f 'playwright.desktop.config.ts' || true
pkill -f 'Electron.*apps/desktop/dist/main/main/index.js' || true
pkill -f 'node --input-type=module' || true
pkill -f 'apps/desktop/node_modules/.bin/../vite/bin/vite.js --port 5173' || true
pkill -f 'node ./node_modules/.bin/../vite/bin/vite.js --port 5173' || true
pkill -f '@esbuild.*AgentHub_new_claude_test.*--service=0.25.12' || true

# 端口确认。
lsof -nP -iTCP:5173 -sTCP:LISTEN
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

```typescript
type DesktopTestProcessKind =
  | 'desktop-vite'
  | 'playwright-electron'
  | 'manual-electron'
  | 'one-off-node-script'
  | 'web-acceptance-server'
  | 'runtime-worker';

interface DesktopTestPreflightResult {
  clean5173: boolean;
  cleanElectron: boolean;
  cleanPlaywright: boolean;
  webServerMode: 'none' | 'acceptance' | 'intentional';
}
```

### 3. Contracts

- 每次运行 Desktop/Electron E2E 前，必须先清理旧 `playwright.desktop.config.ts`、Playwright Electron、手工 Electron、一次性 `node --input-type=module` 脚本和 Desktop Vite `5173`。
- 如果本轮测试需要 Web acceptance 服务，先明确它应由 `pnpm dev:acceptance` 启动；如果本轮只测 Desktop UI，`3000` 可以不存在，但 `5173` 必须由当前测试自己启动。
- 任何 Desktop 测试失败前后，都要用 `ps`/`lsof` 复核是否存在旧 `5173` renderer 或旧 Electron。存在旧进程时，先清理并重跑一次，不能立刻把失败归因到业务代码。
- Electron `DeviceChannel.connect()` 必须能承受 renderer 重载、重复 connect 和旧 socket 仍处于 `CONNECTING` 的情况；旧 socket 清理异常不得变成未捕获异常。
- Vite renderer 环境变量必须由当前进程注入，不能依赖旧 `5173` server 的缓存 bundle。测试需要覆盖不可用 Web 时，应在本轮 Vite 进程中注入不可用 `APP_BASE_URL` / `VITE_WEB_BASE_URL`。

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| `lsof :5173` 显示旧 Desktop Vite | 先 kill 旧进程；不得复用旧 renderer 运行新 E2E |
| `ps` 显示旧 Playwright Electron | 先 kill 旧 Electron 和父 Playwright worker；否则可能触发 single-instance、ready、WebSocket 竞争 |
| Electron 抛 `Cannot create BrowserWindow before app is ready` | 检查是否有旧/并发 Electron 或早发 `activate`；main process 必须 gate `app.isReady()` |
| WebSocket 抛 `WebSocket is not open: readyState 0 (CONNECTING)` | DeviceChannel 发送前必须检查 `readyState === WebSocket.OPEN` |
| WebSocket 抛 `closed before the connection was established` | 不要对 CONNECTING 旧 socket 直接 `close()` / `terminate()` 后放任异常；旧 socket 清理必须吞掉 cleanup errors |
| E2E 期望 Web 不可用错误，但本机 `3000` 正在运行 | 测试必须为当前 Vite renderer 注入不可用 base URL，不能依赖全局机器状态 |

### 5. Good/Base/Bad Cases

- Good：跑 Desktop E2E 前，清理旧 Electron/Vite/Playwright，确认 `5173` 空闲，再由 spec 自己启动 Vite 和 Electron。
- Good：需要同时跑 Web acceptance 时，明确保留 `3000`，但仍清理 `5173` 和旧 Electron；测试内通过 env 控制 Web 可用/不可用场景。
- Base：测试被用户中断后，先执行清理并确认无 `Electron.*apps/desktop`、无 `playwright.desktop`、无 `5173` listener，再继续。
- Bad：旧 `5173` Vite 还在运行，代码已 rebuild 但 Electron 加载旧 bundle，导致错误定位到不存在的问题。
- Bad：多个 Electron 实例复用同一个 Electron user-data-dir 和 DeviceChannel token，产生 WebSocket CONNECTING/close 竞争，然后把未捕获异常误判为业务链路失败。

### 6. Tests Required

- E2E 前置检查：`lsof -nP -iTCP:5173 -sTCP:LISTEN` 必须为空，除非当前测试脚本刚启动并记录了 PID。
- E2E 稳定性：`npx playwright test --config e2e/playwright.desktop.config.ts --workers=1` 不应因旧进程导致 `SIGABRT`、single-instance 或 `BrowserWindow before app ready`。
- DeviceChannel 单元/集成测试：重复调用 `connect()` 时，不应抛出 `WebSocket was closed before the connection was established`。
- Desktop 负向入口测试：当 Web 工作台不可用时，测试必须通过当前 Vite env 注入不可用 base URL，并断言 `web-workspace-error` 可见。
- 验收脚本：如果手工启动 `pnpm dev:acceptance` 或 Desktop Vite，结束前必须清理或在最终状态中明确留下的 PID 和用途。

### 7. Wrong vs Correct

#### Wrong

```bash
# 直接跑，默认机器状态干净。
npx playwright test --config e2e/playwright.desktop.config.ts --workers=1
```

```typescript
if (this.ws) {
  this.ws.close()
}
this.ws = new WebSocket(config.gatewayUrl)
```

#### Correct

```bash
pkill -f 'playwright.desktop.config.ts' || true
pkill -f 'Electron.*apps/desktop/dist/main/main/index.js' || true
pkill -f 'apps/desktop/node_modules/.bin/../vite/bin/vite.js --port 5173' || true
lsof -nP -iTCP:5173 -sTCP:LISTEN
npx playwright test --config e2e/playwright.desktop.config.ts --workers=1
```

```typescript
const oldSocket = this.ws
if (oldSocket) {
  oldSocket.removeAllListeners()
  oldSocket.on('error', () => undefined)
  if (oldSocket.readyState === WebSocket.CONNECTING) {
    oldSocket.once('open', () => oldSocket.close())
  } else if (oldSocket.readyState === WebSocket.OPEN) {
    oldSocket.close()
  }
}

const ws = new WebSocket(config.gatewayUrl)
this.ws = ws
ws.on('open', () => {
  if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) return
  ws.send(serializeFrame(authFrame))
})
```
