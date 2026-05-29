import { describe, it, expect } from 'vitest'
import { redact } from '../../lib/runtime/redact'

describe('redact — key-name matching (backward compatible)', () => {
  it('drops whole value when key looks secret-bearing', () => {
    const out = redact({ token: 'abc', authorization: 'Bearer x', env: { K: 'v' }, summary: 'ok' })
    expect(out.token).toBe('[REDACTED]')
    expect(out.authorization).toBe('[REDACTED]')
    expect(out.env).toBe('[REDACTED]')
    expect(out.summary).toBe('ok')
  })

  it('preserves non-sensitive scalar values', () => {
    const out = redact({ status: 'running', seq: 3, ok: true })
    expect(out).toEqual({ status: 'running', seq: 3, ok: true })
  })
})

describe('redact — value-level credential scanning', () => {
  it('masks high-confidence credential substrings inside innocuous keys', () => {
    const cases: Array<[string, string]> = [
      ['sk-super-secret-token-DO-NOT-LEAK', 'sk-super-'],
      ['ghp_0123456789abcdefghij', 'ghp_'],
      ['xoxb-1234567890-abc', 'xoxb-'],
      ['AKIAIOSFODNN7EXAMPLE', 'AKIA'],
      ['Authorization: Bearer abcd1234efgh', 'Bearer '],
    ]
    for (const [secret, fragment] of cases) {
      const out = redact({ delta: `prefix ${secret} suffix` })
      const serialized = JSON.stringify(out)
      expect(serialized).toContain('[REDACTED]')
      expect(serialized).not.toContain(secret)
      expect(serialized).not.toContain(fragment + (secret.slice(fragment.length, fragment.length + 2)))
    }
  })

  it('redacts credentials nested in delta strings within arrays/objects', () => {
    const out = redact({ chunks: [{ delta: 'key=sk-abcdefgh ok' }, { delta: 'clean text' }] })
    const serialized = JSON.stringify(out)
    expect(serialized).not.toContain('sk-abcdefgh')
    expect(serialized).toContain('clean text')
  })

  it('leaves ordinary prose untouched', () => {
    const out = redact({ delta: 'the quick brown fox jumps' })
    expect(out.delta).toBe('the quick brown fox jumps')
  })
})
