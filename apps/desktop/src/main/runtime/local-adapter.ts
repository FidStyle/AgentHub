import { spawn, type ChildProcess } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import path from 'path'
import type { RuntimeResult } from '@agenthub/shared'
import { resolveCliPath, resolveShell, runShellWithExit, shellQuote } from './cli-resolver'

export interface RuntimePromptRequest {
  runtimeType: 'claude_code' | 'codex'
  prompt: string
}

export const RUNTIME_EXEC_COMMANDS: Record<RuntimePromptRequest['runtimeType'], string> = {
  claude_code: 'claude --print "$AGENTHUB_PROMPT"',
  codex: 'codex exec --skip-git-repo-check --sandbox read-only --color never -- "$AGENTHUB_PROMPT"',
}

const RUNTIME_TIMEOUT_MS: Record<RuntimePromptRequest['runtimeType'], number> = {
  claude_code: 60000,
  codex: 60000,
}

function resolveCwd(cwd: string) {
  if (!cwd || cwd === '.') return process.cwd()
  if (cwd === '~') return homedir()
  if (cwd.startsWith('~/')) return path.join(homedir(), cwd.slice(2))
  return cwd
}

export class LocalRuntimeAdapter {
  type = 'claude_code' as const
  private activeProcess: ChildProcess | null = null

  async execute(request: RuntimePromptRequest, cwd: string): Promise<RuntimeResult> {
    const start = Date.now()
    const resolvedCwd = resolveCwd(cwd)
    const prompt = request.prompt.trim()

    if (!prompt) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: '请输入要发送给本地 Runtime 的消息',
        duration: Date.now() - start,
      }
    }

    if (!existsSync(resolvedCwd)) {
      try {
        mkdirSync(resolvedCwd, { recursive: true })
      } catch {
        return {
          exitCode: 1,
          stdout: '',
          stderr: `无法创建工作目录：${resolvedCwd}`,
          duration: Date.now() - start,
        }
      }
    }

    const command = RUNTIME_EXEC_COMMANDS[request.runtimeType]
    if (!command) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: '当前 Runtime 暂不支持本地一次性消息发送',
        duration: Date.now() - start,
      }
    }

    if (this.activeProcess) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: '已有本地 Runtime 请求正在执行，请先停止或等待完成',
        duration: Date.now() - start,
      }
    }

    const binary = request.runtimeType === 'codex' ? 'codex' : 'claude'
    const cliPath = await resolveCliPath(binary)
    if (!cliPath) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `未找到 ${request.runtimeType === 'codex' ? 'Codex' : 'Claude Code'} CLI，请先完成安装和诊断`,
        duration: Date.now() - start,
      }
    }
    const resolvedCommand = request.runtimeType === 'codex'
      ? `${shellQuote(cliPath)} exec --skip-git-repo-check --sandbox read-only --color never -- "$AGENTHUB_PROMPT"`
      : `${shellQuote(cliPath)} --print "$AGENTHUB_PROMPT"`

    return new Promise<RuntimeResult>((resolve) => {
      let stdout = ''
      let stderr = ''
      let settled = false
      let timedOut = false

      const child = spawn(resolveShell(), ['-lc', resolvedCommand], {
        cwd: resolvedCwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, AGENTHUB_PROMPT: prompt },
      })

      this.activeProcess = child

      const timeout = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL')
        }, 3000)
      }, RUNTIME_TIMEOUT_MS[request.runtimeType])

      const finish = (result: RuntimeResult) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        this.activeProcess = null
        resolve(result)
      }

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString()
      })

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      child.on('error', (error: NodeJS.ErrnoException) => {
        const missingCli = error.code === 'ENOENT' || error.message.includes('ENOENT')
        finish({
          exitCode: 1,
          stdout,
          stderr: missingCli
            ? `未找到 ${request.runtimeType === 'codex' ? 'Codex' : 'Claude Code'} CLI，请先完成安装和诊断`
            : error.message,
          duration: Date.now() - start,
        })
      })

      child.on('close', (code) => {
        const exitCode = code ?? 1
        finish({
          exitCode: timedOut ? 1 : exitCode,
          stdout,
          stderr: timedOut
            ? `${request.runtimeType === 'codex' ? 'Codex' : 'Claude Code'} 响应超时，请稍后重试或在本机终端运行诊断`
            : stderr,
          duration: Date.now() - start,
        })
      })
    })
  }

  cancel(): boolean {
    if (!this.activeProcess) return false
    this.activeProcess.kill('SIGTERM')
    setTimeout(() => {
      if (this.activeProcess && !this.activeProcess.killed) {
        this.activeProcess.kill('SIGKILL')
      }
    }, 3000)
    return true
  }

  async isAvailable(): Promise<boolean> {
    const result = await runShellWithExit('command -v claude || command -v codex || true')
    return Boolean(result.stdout || await resolveCliPath('claude') || await resolveCliPath('codex'))
  }
}
