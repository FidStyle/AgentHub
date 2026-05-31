import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  RUNTIME_DETECTOR_COMMANDS,
  parseCodexDoctorAuthStatus,
  parseCodexLoginStatus,
} from '../src/main/runtime/runtime-detector'
import { getCommonCliCandidates, shellQuote } from '../src/main/runtime/cli-resolver'

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

  it('Finder/Dock 启动兜底会扫描常见 CLI 安装目录', () => {
    const originalNvmDir = process.env.NVM_DIR
    const nvmDir = mkdtempSync(path.join(tmpdir(), 'agenthub-nvm-'))
    mkdirSync(path.join(nvmDir, 'versions/node/v24.15.0/bin'), { recursive: true })
    try {
      process.env.NVM_DIR = nvmDir
      const candidates = getCommonCliCandidates('codex')
      expect(candidates).toContain(path.join(nvmDir, 'versions/node/v24.15.0/bin/codex'))
      expect(candidates).toContain('/opt/homebrew/bin/codex')
      expect(candidates).toContain('/usr/local/bin/codex')
    } finally {
      if (originalNvmDir) process.env.NVM_DIR = originalNvmDir
      else delete process.env.NVM_DIR
    }
  })

  it('shellQuote safely quotes absolute CLI paths', () => {
    expect(shellQuote("/tmp/Agent Hub/codex's/bin")).toBe("'/tmp/Agent Hub/codex'\\''s/bin'")
  })
})
