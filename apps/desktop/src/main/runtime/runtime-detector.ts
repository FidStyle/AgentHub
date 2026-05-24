import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface RuntimeInfo {
  type: 'claude_code' | 'codex'
  available: boolean
  version: string | null
  authenticated: boolean
}

export class RuntimeDetector {
  async detectAll(): Promise<RuntimeInfo[]> {
    const [claude, codex] = await Promise.all([
      this.detectClaude(),
      this.detectCodex(),
    ])
    return [claude, codex]
  }

  private async detectClaude(): Promise<RuntimeInfo> {
    const info: RuntimeInfo = { type: 'claude_code', available: false, version: null, authenticated: false }
    try {
      const { stdout } = await execAsync('claude --version 2>/dev/null || echo ""', { timeout: 5000 })
      const version = stdout.trim()
      if (version && !version.includes('not found')) {
        info.available = true
        info.version = version.split('\n')[0]
        try {
          const { stdout: authOut } = await execAsync('claude auth status 2>&1 || echo "not authenticated"', { timeout: 5000 })
          info.authenticated = !authOut.includes('not authenticated') && !authOut.includes('error')
        } catch { /* auth check failed */ }
      }
    } catch { /* not installed */ }
    return info
  }

  private async detectCodex(): Promise<RuntimeInfo> {
    const info: RuntimeInfo = { type: 'codex', available: false, version: null, authenticated: false }
    try {
      const { stdout } = await execAsync('codex --version 2>/dev/null || echo ""', { timeout: 5000 })
      const version = stdout.trim()
      if (version && !version.includes('not found')) {
        info.available = true
        info.version = version.split('\n')[0]
        info.authenticated = true
      }
    } catch { /* not installed */ }
    return info
  }
}
