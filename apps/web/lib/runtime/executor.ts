import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

export interface ExecutorChunk {
  delta: string
}

export interface ExecutorJob {
  prompt: string
  fail?: boolean
}

export interface RuntimeExecutor {
  execute(job: ExecutorJob): AsyncIterable<ExecutorChunk>
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

// CliRuntimeExecutor: spawns the real claude/codex CLI and streams stdout lines as chunks.
// stderr is consumed for failure diagnosis only and is NOT forwarded as output (avoids leaking
// credential-bearing error text). A missing binary (ENOENT) surfaces as ExecutorUnavailableError.
export class CliRuntimeExecutor implements RuntimeExecutor {
  constructor(private readonly options: CliExecutorOptions) {}

  async *execute(job: ExecutorJob): AsyncIterable<ExecutorChunk> {
    const binary = CLI_BINARY[this.options.runtimeType]
    const child = spawn(binary, ['-p', job.prompt], {
      cwd: this.options.cwd,
      env: { ...process.env, ...this.options.env },
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
    rl.on('line', (line) => { queue.push({ delta: line + '\n' }); wake() })

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
