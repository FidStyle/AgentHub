import { execFile } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import path from 'path'
import { promisify } from 'util'
import type { RuntimeResult } from '@agenthub/shared'

const execFileAsync = promisify(execFile)

export interface RuntimePromptRequest {
  runtimeType: 'claude_code' | 'codex'
  prompt: string
}

const RUNTIME_COMMANDS: Record<RuntimePromptRequest['runtimeType'], string> = {
  claude_code: 'claude --print "$AGENTHUB_PROMPT"',
  codex: 'codex exec "$AGENTHUB_PROMPT"',
}

function resolveShell() {
  return process.env.SHELL?.startsWith('/') ? process.env.SHELL : '/bin/zsh'
}

function resolveCwd(cwd: string) {
  if (!cwd || cwd === '.') return process.cwd()
  if (cwd === '~') return homedir()
  if (cwd.startsWith('~/')) return path.join(homedir(), cwd.slice(2))
  return cwd
}

export class LocalRuntimeAdapter {
  type = 'claude_code' as const

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

    const command = RUNTIME_COMMANDS[request.runtimeType]
    if (!command) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: '当前 Runtime 暂不支持本地一次性消息发送',
        duration: Date.now() - start,
      }
    }

    try {
      const { stdout, stderr } = await execFileAsync(resolveShell(), ['-lc', command], {
        cwd: resolvedCwd,
        timeout: 120000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, AGENTHUB_PROMPT: prompt },
      })
      return { exitCode: 0, stdout, stderr, duration: Date.now() - start }
    } catch (err: unknown) {
      const e = err as { code?: number | string; stdout?: string; stderr?: string; message?: string }
      const stderr = e.stderr ?? e.message ?? ''
      const missingCli = stderr.includes('command not found') || e.code === 'ENOENT'
      return {
        exitCode: typeof e.code === 'number' ? e.code : 1,
        stdout: e.stdout ?? '',
        stderr: missingCli
          ? `未找到 ${request.runtimeType === 'codex' ? 'Codex' : 'Claude Code'} CLI，请先完成安装和诊断`
          : stderr,
        duration: Date.now() - start,
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync(resolveShell(), ['-lc', 'command -v claude || command -v codex'])
      return true
    } catch {
      return false
    }
  }
}
