# Runtime Credential Boundary

## Scenario: Local Runtime Credentials Stay Local

### 1. Scope / Trigger

- Trigger: modifying Runtime settings, Role Agent runtime binding, Desktop connector auth, runtime status/doctor UI, or screenshots involving runtime config.

### 2. Signatures

- Runtime IDs: `claude_code`, `codex`
- Diagnostic APIs may return status/version/auth state, not secrets.
- Forbidden UI/env fields: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, provider Base URL, raw token inputs for local CLI runtimes.

### 3. Contracts

- AgentHub does not store or proxy local Claude Code/Codex API keys.
- Local runtime auth is handled by the native CLI on the user's machine.
- Web/Mobile can display runtime status and guide installation/login; Desktop performs local checks.
- Runtime product name is not a chat participant. Users chat with Role Agents.
- OAuth in an external browser does not automatically authenticate Electron; Desktop identity needs a device binding/deep link/main-process session bridge.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| UI tries to save local CLI API key | forbidden; remove/disable field |
| Runtime CLI not installed | show install/diagnostic state |
| Runtime CLI not logged in | show local-login guidance |
| Desktop lacks identity bridge | show unbound/offline state, not authenticated |

### 5. Good/Base/Bad Cases

- Good: Runtime settings show Claude Code detected/logged-in status with no key fields.
- Base: Runtime not installed shows Chinese setup guidance.
- Bad: Agent edit form includes an OpenAI/Anthropic API key input for local Codex/Claude Code.

### 6. Tests Required

- UI source/screenshot sensitive-field assertions.
- Runtime status API tests for installed/auth/error states.
- Desktop auth bridge or device-binding tests when Desktop login is touched.

### 7. Wrong vs Correct

#### Wrong

- Save `OPENAI_API_KEY` in AgentHub Role Agent settings.

#### Correct

- Bind Role Agent to `runtime_type=codex` and let local Codex CLI own authentication.
