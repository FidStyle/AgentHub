import { describe, expect, it } from 'vitest'
import { RUNTIME_EXEC_COMMANDS } from '../src/main/runtime/local-adapter'

describe('LocalRuntimeAdapter command contract', () => {
  it('uses non-interactive Codex exec options for one-shot prompts', () => {
    expect(RUNTIME_EXEC_COMMANDS.codex).toContain('codex exec')
    expect(RUNTIME_EXEC_COMMANDS.codex).toContain('--skip-git-repo-check')
    expect(RUNTIME_EXEC_COMMANDS.codex).toContain('--sandbox read-only')
    expect(RUNTIME_EXEC_COMMANDS.codex).toContain('--color never')
    expect(RUNTIME_EXEC_COMMANDS.codex).toContain('-- "$AGENTHUB_PROMPT"')
  })

  it('uses Claude Code print mode for one-shot prompts', () => {
    expect(RUNTIME_EXEC_COMMANDS.claude_code).toBe('claude --print "$AGENTHUB_PROMPT"')
  })
})
