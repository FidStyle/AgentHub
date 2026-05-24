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
  detectionSnapshot: RuntimeDetectionResult;
}
```

### 3. 契约

- 本地 `claude_code` / `codex` 绑定只允许保存 `runtimeKind`、`executionDomain`、`cliPath`、`version`、`authStatus`、`capabilities`、诊断码和 native session 绑定。
- 禁止在本地 Runtime 绑定、Role Agent 配置、Workspace、Session、Message、Runtime Event 中保存原始 `ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`GEMINI_API_KEY`、`*_BASE_URL` 或等价密钥/中转地址。
- Web 配置页只能展示检测状态、版本、登录状态、能力声明、修复引导和 Runtime 选择。
- Desktop Connector 可以继承当前进程环境执行用户本机 CLI，但不得把敏感环境变量回传到 Web 或后端。
- 平台托管 Runtime 或模型 Provider 如需 API Key，必须走单独凭证/模型供应商能力，并且不能复用本地 CLI Runtime Binding 数据结构。

### 4. 校验与错误矩阵

| 条件 | 错误或状态 |
| --- | --- |
| Web/API 提交本地 `claude_code` / `codex` 绑定时携带 `apiKey`、`env`、`baseUrl` | 拒绝保存，返回 `SECRET_FIELD_NOT_ALLOWED` |
| Desktop 未检测到 CLI | `RUNTIME_NOT_FOUND`，`installed=false` |
| CLI 存在但未登录或调用返回认证失败 | `RUNTIME_AUTH_REQUIRED`，`authStatus='auth_required'` |
| Workspace 是 `cloud` 但绑定本地 Runtime | `EXECUTION_DOMAIN_MISMATCH` |
| Workspace 是 `local_desktop` 但 Desktop Connector 离线 | `DEVICE_OFFLINE` |
| Runtime 执行事件包含疑似密钥值 | 写入前脱敏，测试中断言不落库 |

### 5. 正常/基线/错误用例

- 正常：用户在本机完成 `claude login` 或 `codex login` 后，Desktop 检测到 `authenticated`，Web 只显示“已登录、版本、能力”，Role Agent 绑定该 Runtime。
- 基线：用户没有安装 Codex，Web 显示“未检测到 Codex CLI”和安装指引，不出现 API Key 输入框。
- 错误：Agent 配置页出现“自定义 API Key”字段，并把 `OPENAI_API_KEY` 保存到 `runtime_bindings` 或 `runtime-config.json` 作为默认 P0 路径。

### 6. 必需测试

- 单元测试：`assertRuntimeBindingAllowed` 拒绝本地 Runtime 绑定中的 `apiKey`、`env`、`baseUrl` 字段。
- Desktop 单元测试：Runtime Detector 将 CLI not found、auth required、authenticated 映射到稳定诊断码。
- API 集成测试：创建/更新 Role Agent Runtime Binding 时，Cloud/Local 执行域不匹配被拒绝，敏感字段被拒绝。
- 前端组件测试：本地 Claude Code / Codex 配置页只渲染检测、绑定、诊断和引导控件，不渲染 API Key 输入框。
- E2E：本地 Runtime 未登录时，用户不能启动执行；完成本机登录并重新检测后，可以绑定并发起 Runtime 请求。

### 7. 错误与正确示例

#### 错误

```typescript
await saveRuntimeBinding({
  workspaceId,
  roleAgentId,
  runtimeKind: 'codex',
  executionDomain: 'local_desktop',
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
  detectionSnapshot: detection,
});
```

密钥属于用户本机 Codex/Claude 原生认证或独立模型 Provider，不属于本地 CLI Runtime Binding。
