import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'

export interface ExecutorChunk {
  delta?: string
  nativeSessionId?: string
}

export interface ExecutorJob {
  prompt: string
  fail?: boolean
  nativeSessionId?: string | null
}

export interface RuntimeExecutor {
  execute(job: ExecutorJob): AsyncIterable<ExecutorChunk>
}

export interface CliRuntimeCapability {
  type: CliRuntimeType
  available: boolean
  authenticated: boolean
  launchable: boolean
  supportsResume: boolean
  supportsContinue: boolean
  version?: string
  cliPath?: string
  diagnostic?: string
}

// Thrown when the real CLI binary is missing or cannot be spawned. The worker maps this to a
// runtime_failed event instead of pretending the job succeeded.
export class ExecutorUnavailableError extends Error {
  readonly code = 'executor_unavailable'
  constructor(message: string) {
    super(message)
    this.name = 'ExecutorUnavailableError'
  }
}

export type CliRuntimeType = 'claude_code' | 'codex'

export interface CliExecutorOptions {
  runtimeType: CliRuntimeType
  cwd?: string
  // Credentials are injected here into the child process env only — never echoed into chunks/logs.
  env?: Record<string, string>
}

const CLI_BINARY: Record<CliRuntimeType, string> = { claude_code: 'claude', codex: 'codex' }

function runProbe(command: string, args: string[], timeout = 5000) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout,
    env: process.env,
  })
  return {
    ok: result.status === 0,
    stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
    stderr: typeof result.stderr === 'string' ? result.stderr.trim() : '',
    error: result.error?.message,
  }
}

function resolveCommandPath(binary: string) {
  const result = runProbe('sh', ['-lc', `command -v ${binary} || true`], 3000)
  return result.stdout.split(/\r?\n/).find(Boolean) ?? null
}

export function detectCliRuntimeCapabilities(): CliRuntimeCapability[] {
  const claudePath = resolveCommandPath('claude')
  const codexPath = resolveCommandPath('codex')
  const claudeVersion = claudePath ? runProbe(claudePath, ['--version']).stdout : ''
  const codexVersion = codexPath ? runProbe(codexPath, ['--version']).stdout : ''
  const claudeAuth = claudePath ? runProbe(claudePath, ['auth', 'status', '--json'], 8000) : null
  const codexAuth = codexPath ? runProbe(codexPath, ['login', 'status'], 8000) : null

  return [
    {
      type: 'claude_code',
      available: Boolean(claudePath),
      authenticated: Boolean(claudePath && claudeAuth?.ok),
      launchable: Boolean(claudePath && claudeAuth?.ok),
      supportsResume: true,
      supportsContinue: true,
      version: claudeVersion || undefined,
      cliPath: claudePath ?? undefined,
      diagnostic: claudePath ? (claudeAuth?.ok ? 'authenticated' : claudeAuth?.stderr || claudeAuth?.stdout || claudeAuth?.error || 'auth status failed') : 'claude CLI not found',
    },
    {
      type: 'codex',
      available: Boolean(codexPath),
      authenticated: Boolean(codexPath && codexAuth?.ok),
      launchable: Boolean(codexPath && codexAuth?.ok),
      supportsResume: true,
      supportsContinue: true,
      version: codexVersion || undefined,
      cliPath: codexPath ?? undefined,
      diagnostic: codexPath ? (codexAuth?.ok ? 'authenticated' : codexAuth?.stderr || codexAuth?.stdout || codexAuth?.error || 'login status failed') : 'codex CLI not found',
    },
  ]
}

export function cliArgs(runtimeType: CliRuntimeType, prompt: string, nativeSessionId?: string | null) {
  if (runtimeType === 'codex') {
    if (nativeSessionId) {
      return ['exec', 'resume', '--json', '--skip-git-repo-check', nativeSessionId, prompt]
    }
    return ['exec', '--json', '-s', 'read-only', '--skip-git-repo-check', '--color', 'never', prompt]
  }
  if (nativeSessionId) {
    return ['--print', '--verbose', '--output-format', 'stream-json', '--include-partial-messages', '--resume', nativeSessionId, prompt]
  }
  return ['--print', '--verbose', '--output-format', 'stream-json', '--include-partial-messages', prompt]
}

function splitOutput(text: string) {
  return text.match(/.{1,12}/gu) ?? [text]
}

function nativeSessionIdFromRecord(record: Record<string, unknown>) {
  const sessionId = record.session_id ?? record.sessionId ?? record.thread_id ?? record.threadId ?? record.conversation_id ?? record.conversationId
  return typeof sessionId === 'string' && sessionId ? sessionId : null
}

export function outputChunks(runtimeType: CliRuntimeType, line: string): ExecutorChunk[] {
  if (runtimeType !== 'codex') {
    try {
      const record = JSON.parse(line) as Record<string, unknown>
      const nativeSessionId = nativeSessionIdFromRecord(record)
      const result = typeof record.result === 'string' ? record.result : null
      const nestedEvent = record.event && typeof record.event === 'object'
        ? record.event as Record<string, unknown>
        : null
      const nestedDelta = nestedEvent?.delta && typeof nestedEvent.delta === 'object'
        ? nestedEvent.delta as Record<string, unknown>
        : null
      const delta = typeof record.delta === 'string'
        ? record.delta
        : typeof nestedDelta?.text === 'string'
          ? nestedDelta.text
        : record.type === 'content_block_delta' &&
          record.delta &&
          typeof record.delta === 'object' &&
          'text' in record.delta &&
          typeof (record.delta as { text?: unknown }).text === 'string'
            ? (record.delta as { text: string }).text
            : null
      return [
        ...(nativeSessionId ? [{ nativeSessionId }] : []),
        ...(delta ? [{ delta }] : result ? splitOutput(result).map((part) => ({ delta: part })) : []),
      ]
    } catch {
      return [{ delta: line + '\n' }]
    }
  }
  try {
    const evt = JSON.parse(line) as { type?: string; item?: { type?: string; text?: string; session_id?: string; sessionId?: string } } & Record<string, unknown>
    const nativeSessionId = nativeSessionIdFromRecord(evt)
      ?? (evt.item && typeof evt.item === 'object' ? nativeSessionIdFromRecord(evt.item as unknown as Record<string, unknown>) : null)
    if (evt.type === 'item.completed' && evt.item?.type === 'agent_message' && evt.item.text) {
      return [
        ...(nativeSessionId ? [{ nativeSessionId }] : []),
        ...splitOutput(evt.item.text).map((delta) => ({ delta })),
      ]
    }
    return nativeSessionId ? [{ nativeSessionId }] : []
  } catch {
    return line.trim() ? [{ delta: `${line}\n` }] : []
  }
}

// CliRuntimeExecutor: spawns the real claude/codex CLI and streams stdout lines as chunks.
// stderr is consumed for failure diagnosis only and is NOT forwarded as output (avoids leaking
// credential-bearing error text). A missing binary (ENOENT) surfaces as ExecutorUnavailableError.
export class CliRuntimeExecutor implements RuntimeExecutor {
  constructor(private readonly options: CliExecutorOptions) {}

  async *execute(job: ExecutorJob): AsyncIterable<ExecutorChunk> {
    const binary = CLI_BINARY[this.options.runtimeType]
    const child = spawn(binary, cliArgs(this.options.runtimeType, job.prompt, job.nativeSessionId), {
      cwd: this.options.cwd,
      env: { ...process.env, ...this.options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const queue: ExecutorChunk[] = []
    let spawnError: ExecutorUnavailableError | null = null
    let exitError: Error | null = null
    let done = false
    let notify: (() => void) | null = null
    const wake = () => { notify?.(); notify = null }

    child.on('error', (err: NodeJS.ErrnoException) => {
      spawnError = new ExecutorUnavailableError(
        err.code === 'ENOENT' ? `runtime CLI '${binary}' not found` : `failed to spawn '${binary}'`,
      )
      done = true
      wake()
    })

    const rl = createInterface({ input: child.stdout })
    rl.on('line', (line) => {
      queue.push(...outputChunks(this.options.runtimeType, line))
      wake()
    })

    // Drain stderr so a chatty CLI can't fill the pipe buffer and block, but never forward it as
    // output — stderr may carry credential-bearing error text.
    child.stderr?.resume()

    child.on('close', (code) => {
      if (code !== 0 && !spawnError) exitError = new Error(`runtime CLI exited with code ${code ?? 'null'}`)
      done = true
      wake()
    })

    while (true) {
      if (spawnError) throw spawnError
      while (queue.length > 0) yield queue.shift()!
      if (done) break
      await new Promise<void>((resolve) => { notify = resolve })
    }
    if (spawnError) throw spawnError
    if (exitError) throw exitError
  }
}

// FakeExecutor: echoes the prompt as space-delimited streamed chunks. No paid API, no real CLI spawn.
// job.fail injects a mid-stream failure to exercise the failure path.
export class FakeExecutor implements RuntimeExecutor {
  async *execute(job: ExecutorJob): AsyncIterable<ExecutorChunk> {
    const words = job.prompt.trim().split(/\s+/).filter(Boolean)
    const tokens = words.length > 0 ? words : ['echo']
    for (let i = 0; i < tokens.length; i++) {
      if (job.fail && i === Math.floor(tokens.length / 2)) {
        throw new Error('FakeExecutor injected failure')
      }
      yield { delta: i === 0 ? tokens[i] : ` ${tokens[i]}` }
    }
  }
}

// ScriptedRealExecutor: streams a fixed, recognizable reply that does NOT echo the prompt. Unlike
// FakeExecutor (which echoes input), this stands in for a real executor's produced output — used to
// validate the full enqueue→worker→DB delivery path with a deterministic, non-echo reply where a
// paid CLI isn't desirable. The reply is configurable via RUNTIME_SCRIPT_REPLY.
export class ScriptedRealExecutor implements RuntimeExecutor {
  async *execute(job: ExecutorJob): AsyncIterable<ExecutorChunk> {
    const reply = process.env.RUNTIME_SCRIPT_REPLY ?? '已收到你的请求，这是运行时执行器返回的回复。'
    const segments = reply.match(/.{1,8}/gu) ?? [reply]
    for (let i = 0; i < segments.length; i++) {
      if (job.fail && i === Math.floor(segments.length / 2)) {
        throw new Error('ScriptedRealExecutor injected failure')
      }
      yield { delta: segments[i] }
    }
  }
}
