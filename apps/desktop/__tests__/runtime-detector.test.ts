import { describe, expect, it } from 'vitest'
import { RUNTIME_DETECTOR_COMMANDS } from '../src/main/runtime/runtime-detector'

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
})
