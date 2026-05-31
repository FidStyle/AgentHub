import { resolveCliPath, runShell, runShellWithExit, shellQuote } from './cli-resolver'

export const RUNTIME_DETECTOR_COMMANDS = {
  claude: {
    resolvePath: 'command -v claude || true',
    version: 'claude --version',
    authStatus: 'claude auth status --json',
    login: 'claude auth login',
  },
  codex: {
    resolvePath: 'command -v codex || true',
    version: 'codex --version',
    authStatus: 'codex login status',
    login: 'codex login',
    doctor: 'codex doctor --json',
  },
} as const

function parseClaudeAuthStatus(output: string): boolean {
  try {
    const status = JSON.parse(output) as { loggedIn?: boolean }
    return status.loggedIn === true
  } catch {
    const normalized = output.toLowerCase()
    return normalized.includes('logged in') || normalized.includes('authenticated')
  }
}

export function parseCodexLoginStatus(output: string): boolean {
  const normalized = output.toLowerCase()
  return (
    normalized.includes('logged in') ||
    normalized.includes('authenticated') ||
    normalized.includes('api key')
  ) && !normalized.includes('not logged in') && !normalized.includes('not authenticated')
}

export function parseCodexDoctorAuthStatus(output: string): boolean {
  if (!output) return false
  try {
    const report = JSON.parse(output) as {
      checks?: Record<string, { status?: string }>
    }
    return report.checks?.['auth.credentials']?.status === 'ok'
  } catch {
    return false
  }
}

function summarizeCodexDoctor(output: string): string | null {
  if (!output) return null
  try {
    const report = JSON.parse(output) as {
      overallStatus?: string
      checks?: Record<string, { status?: string; summary?: string }>
    }
    if (!report.overallStatus || report.overallStatus === 'ok') return null
    const issue = Object.entries(report.checks ?? {}).find(([, check]) => check.status && check.status !== 'ok')
    if (!issue) return `doctor ${report.overallStatus}`
    const [id, check] = issue
    return `doctor ${report.overallStatus}: ${id} ${check.summary ?? ''}`.trim()
  } catch {
    return null
  }
}

export interface RuntimeInfo {
  type: 'claude_code' | 'codex'
  available: boolean
  version: string | null
  authenticated: boolean
  launchable: boolean
  cliPath: string | null
  diagnosticCode: 'RUNTIME_NOT_FOUND' | 'RUNTIME_AUTH_REQUIRED' | 'RUNTIME_READY' | 'RUNTIME_CHECK_FAILED'
  diagnosticMessage: string
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
    const info: RuntimeInfo = {
      type: 'claude_code',
      available: false,
      version: null,
      authenticated: false,
      launchable: false,
      cliPath: null,
      diagnosticCode: 'RUNTIME_NOT_FOUND',
      diagnosticMessage: '未检测到 Claude Code CLI',
    }
    try {
      info.cliPath = await resolveCliPath('claude')
      if (!info.cliPath) return info

      const claude = shellQuote(info.cliPath)
      const version = await runShell(`${claude} --version`)
      if (version && !version.includes('not found')) {
        info.available = true
        info.launchable = true
        info.version = version.split('\n')[0]
        try {
          const authOut = await runShell(`${claude} auth status --json`)
          info.authenticated = parseClaudeAuthStatus(authOut)
          info.diagnosticCode = info.authenticated ? 'RUNTIME_READY' : 'RUNTIME_AUTH_REQUIRED'
          info.diagnosticMessage = info.authenticated ? 'Claude Code 已安装并完成认证' : 'Claude Code 未登录或认证不可用，请在本机 CLI 完成登录'
        } catch {
          info.diagnosticCode = 'RUNTIME_AUTH_REQUIRED'
          info.diagnosticMessage = 'Claude Code 认证状态不可确认，请在本机运行 claude auth status --json 检查'
        }
      }
    } catch (error) {
      info.diagnosticCode = 'RUNTIME_CHECK_FAILED'
      info.diagnosticMessage = error instanceof Error ? error.message : 'Claude Code 检测失败'
    }
    return info
  }

  private async detectCodex(): Promise<RuntimeInfo> {
    const info: RuntimeInfo = {
      type: 'codex',
      available: false,
      version: null,
      authenticated: false,
      launchable: false,
      cliPath: null,
      diagnosticCode: 'RUNTIME_NOT_FOUND',
      diagnosticMessage: '未检测到 Codex CLI',
    }
    try {
      info.cliPath = await resolveCliPath('codex')
      if (!info.cliPath) return info

      const codex = shellQuote(info.cliPath)
      const version = await runShell(`${codex} --version`)
      if (version && !version.includes('not found')) {
        info.available = true
        info.launchable = true
        info.version = version.split('\n')[0]
        const [authOut, doctor] = await Promise.all([
          runShellWithExit(`${codex} login status`),
          runShellWithExit(`${codex} doctor --json`, { timeout: 10000 }),
        ])
        info.authenticated =
          parseCodexLoginStatus(authOut.stdout) ||
          parseCodexDoctorAuthStatus(doctor.stdout)
        info.diagnosticCode = info.authenticated ? 'RUNTIME_READY' : 'RUNTIME_AUTH_REQUIRED'
        info.diagnosticMessage = info.authenticated ? 'Codex 已安装并完成认证' : 'Codex 未登录或认证状态不可确认，请在本机 CLI 完成登录后重新检测'
        if (info.authenticated) {
          const doctorSummary = summarizeCodexDoctor(doctor.stdout)
          if (doctorSummary) {
            info.diagnosticMessage = `Codex 已安装并完成认证；${doctorSummary}`
          }
        }
      }
    } catch (error) {
      info.diagnosticCode = 'RUNTIME_CHECK_FAILED'
      info.diagnosticMessage = error instanceof Error ? error.message : 'Codex 检测失败'
    }
    return info
  }
}
