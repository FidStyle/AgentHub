import { spawn, type ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import type { RuntimeEvent } from '@agenthub/shared'

export class StreamAdapter {
  private process: ChildProcess | null = null
  private sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  async execute(
    command: string,
    args: string[],
    cwd: string,
    onEvent: (event: RuntimeEvent) => void,
    extraEnv?: Record<string, string>,
  ): Promise<number> {
    return new Promise((resolve) => {
      this.process = spawn(command, args, {
        cwd,
        shell: true,
        env: { ...process.env, ...extraEnv },
      })

      onEvent({
        type: 'started',
        sessionId: this.sessionId,
        timestamp: Date.now(),
        runtimeType: command.includes('codex') ? 'codex' : 'claude_code',
        cwd,
      })

      if (this.process.stdout) {
        const rl = createInterface({ input: this.process.stdout })
        rl.on('line', (line) => {
          onEvent({
            type: 'text_delta',
            sessionId: this.sessionId,
            timestamp: Date.now(),
            delta: line + '\n',
          })
        })
      }

      if (this.process.stderr) {
        const rl = createInterface({ input: this.process.stderr })
        rl.on('line', (line) => {
          onEvent({
            type: 'text_delta',
            sessionId: this.sessionId,
            timestamp: Date.now(),
            delta: `[stderr] ${line}\n`,
          })
        })
      }

      this.process.on('close', (code) => {
        const exitCode = code ?? 1
        if (exitCode === 0) {
          onEvent({
            type: 'completed',
            sessionId: this.sessionId,
            timestamp: Date.now(),
            exitCode,
          })
        } else {
          onEvent({
            type: 'failed',
            sessionId: this.sessionId,
            timestamp: Date.now(),
            error: `进程退出码: ${exitCode}`,
            exitCode,
          })
        }
        resolve(exitCode)
      })

      this.process.on('error', (err) => {
        onEvent({
          type: 'failed',
          sessionId: this.sessionId,
          timestamp: Date.now(),
          error: err.message,
        })
        resolve(1)
      })
    })
  }

  cancel() {
    if (this.process) {
      this.process.kill('SIGTERM')
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL')
        }
      }, 5000)
    }
  }
}
