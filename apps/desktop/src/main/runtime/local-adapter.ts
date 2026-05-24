import { exec } from 'child_process'
import { promisify } from 'util'
import type { RuntimeAdapter, RuntimeResult } from '@agenthub/shared'

const execAsync = promisify(exec)

export class LocalRuntimeAdapter implements RuntimeAdapter {
  type = 'claude_code' as const

  async execute(command: string, cwd: string): Promise<RuntimeResult> {
    const start = Date.now()
    try {
      const { stdout, stderr } = await execAsync(command, { cwd, timeout: 30000 })
      return { exitCode: 0, stdout, stderr, duration: Date.now() - start }
    } catch (err: any) {
      return {
        exitCode: err.code ?? 1,
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? err.message,
        duration: Date.now() - start,
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync('which claude || where claude')
      return true
    } catch {
      return false
    }
  }
}
