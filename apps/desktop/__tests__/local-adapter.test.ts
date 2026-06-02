import { describe, expect, it } from 'vitest'
import {
  RUNTIME_EXEC_COMMANDS,
  buildRuntimeCommand,
  extractClaudeNativeSessionId,
  extractCodexNativeSessionId,
  normalizeClaudePrintOutput,
  normalizeCodexExecOutput,
} from '../src/main/runtime/local-adapter'

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
    expect(RUNTIME_EXEC_COMMANDS.claude_code).toBe('claude --print --output-format json "$AGENTHUB_PROMPT"')
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

  it('extracts Claude Code native session id from print JSON', () => {
    const payload = JSON.stringify({
      type: 'result',
      session_id: '11111111-1111-4111-8111-111111111111',
      result: '继续后的回复',
    })

    expect(normalizeClaudePrintOutput(payload)).toBe('继续后的回复')
    expect(extractClaudeNativeSessionId(payload)).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('extracts Codex native session id from JSONL events', () => {
    const transcript = [
      JSON.stringify({ type: 'session', session_id: '22222222-2222-4222-8222-222222222222' }),
      JSON.stringify({ type: 'message', role: 'assistant' }),
    ].join('\n')

    expect(extractCodexNativeSessionId(transcript)).toBe('22222222-2222-4222-8222-222222222222')
  })

  it('builds official Claude Code resume and continue commands', () => {
    expect(buildRuntimeCommand('claude_code', '/bin/claude', {
      runtimeType: 'claude_code',
      prompt: 'next',
      nativeSessionId: '11111111-1111-4111-8111-111111111111',
    })).toContain("--resume '11111111-1111-4111-8111-111111111111'")

    expect(buildRuntimeCommand('claude_code', '/bin/claude', {
      runtimeType: 'claude_code',
      prompt: 'next',
      continueLast: true,
    })).toContain('--continue "$AGENTHUB_PROMPT"')
  })

  it('builds official Codex exec resume commands', () => {
    expect(buildRuntimeCommand('codex', '/bin/codex', {
      runtimeType: 'codex',
      prompt: 'next',
      nativeSessionId: '22222222-2222-4222-8222-222222222222',
    })).toContain('exec resume --skip-git-repo-check --output-last-message "$AGENTHUB_OUTPUT_FILE" \'22222222-2222-4222-8222-222222222222\' "$AGENTHUB_PROMPT"')

    expect(buildRuntimeCommand('codex', '/bin/codex', {
      runtimeType: 'codex',
      prompt: 'next',
      continueLast: true,
    })).toContain('exec resume --last --skip-git-repo-check --output-last-message "$AGENTHUB_OUTPUT_FILE" "$AGENTHUB_PROMPT"')
  })
})
