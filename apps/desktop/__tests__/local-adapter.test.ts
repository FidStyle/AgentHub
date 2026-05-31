import { describe, expect, it } from 'vitest'
import { RUNTIME_EXEC_COMMANDS, normalizeCodexExecOutput } from '../src/main/runtime/local-adapter'

describe('LocalRuntimeAdapter command contract', () => {
  it('uses non-interactive Codex exec options for one-shot prompts', () => {
    expect(RUNTIME_EXEC_COMMANDS.codex).toContain('codex exec')
    expect(RUNTIME_EXEC_COMMANDS.codex).toContain('--skip-git-repo-check')
    expect(RUNTIME_EXEC_COMMANDS.codex).toContain('--sandbox read-only')
    expect(RUNTIME_EXEC_COMMANDS.codex).toContain('--color never')
    expect(RUNTIME_EXEC_COMMANDS.codex).toContain('--output-last-message "$AGENTHUB_OUTPUT_FILE"')
    expect(RUNTIME_EXEC_COMMANDS.codex).toContain('-- "$AGENTHUB_PROMPT"')
  })

  it('uses Claude Code print mode for one-shot prompts', () => {
    expect(RUNTIME_EXEC_COMMANDS.claude_code).toBe('claude --print "$AGENTHUB_PROMPT"')
  })

  it('prefers Codex output-last-message content over verbose CLI transcript', () => {
    const transcript = [
      'Reading additional input from stdin...',
      'OpenAI Codex v0.135.0',
      'user',
      '你是谁',
      'codex',
      '旧输出',
      'tokens used',
      '999',
    ].join('\n')

    expect(normalizeCodexExecOutput(transcript, '我是 Codex')).toBe('我是 Codex')
  })

  it('removes Codex transcript chrome when output-last-message is unavailable', () => {
    const transcript = [
      'Reading additional input from stdin...',
      'OpenAI Codex v0.135.0',
      'workdir: /Users/test',
      'user',
      '你是谁',
      'codex',
      '我是 Codex，一个本地编码助手。',
      'tokens used',
      '13,975',
    ].join('\n')

    expect(normalizeCodexExecOutput(transcript)).toBe('我是 Codex，一个本地编码助手。')
  })
})
