import { describe, expect, it } from 'vitest'
import {
  RUNTIME_DETECTOR_COMMANDS,
  parseCodexDoctorAuthStatus,
  parseCodexLoginStatus,
} from '../src/main/runtime/runtime-detector'

describe('RuntimeDetector command contract', () => {
  it('uses real Claude Code authentication commands', () => {
    expect(RUNTIME_DETECTOR_COMMANDS.claude.resolvePath).toBe('command -v claude || true')
    expect(RUNTIME_DETECTOR_COMMANDS.claude.version).toBe('claude --version')
    expect(RUNTIME_DETECTOR_COMMANDS.claude.authStatus).toBe('claude auth status --json')
    expect(RUNTIME_DETECTOR_COMMANDS.claude.login).toBe('claude auth login')
  })

  it('uses real Codex authentication and diagnostic commands', () => {
    expect(RUNTIME_DETECTOR_COMMANDS.codex.resolvePath).toBe('command -v codex || true')
    expect(RUNTIME_DETECTOR_COMMANDS.codex.version).toBe('codex --version')
    expect(RUNTIME_DETECTOR_COMMANDS.codex.authStatus).toBe('codex login status')
    expect(RUNTIME_DETECTOR_COMMANDS.codex.login).toBe('codex login')
    expect(RUNTIME_DETECTOR_COMMANDS.codex.doctor).toBe('codex doctor --json')
  })

  it('recognizes Codex API-key login status output', () => {
    expect(parseCodexLoginStatus('Logged in using an API key - clp_9967***ba3ff')).toBe(true)
    expect(parseCodexLoginStatus('Not logged in')).toBe(false)
  })

  it('uses codex doctor auth.credentials as authenticated fallback', () => {
    expect(parseCodexDoctorAuthStatus(JSON.stringify({
      overallStatus: 'warning',
      checks: {
        'auth.credentials': { status: 'ok', summary: 'auth is configured' },
        'terminal.env': { status: 'warning', summary: 'height 19 rows' },
      },
    }))).toBe(true)
    expect(parseCodexDoctorAuthStatus(JSON.stringify({
      checks: {
        'auth.credentials': { status: 'fail' },
      },
    }))).toBe(false)
  })
})
