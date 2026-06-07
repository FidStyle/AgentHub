// Shared redaction for runtime_logs. Two layers, applied on every write path
// (gateway persistRuntimeEvent + worker log()):
//   1. key-name match — whole value dropped when the key looks secret-bearing
//   2. value-level scan — high-confidence credential substrings inside string
//      values are masked even when the key is innocuous (e.g. a delta containing
//      `Authorization: Bearer sk-...`).
const SECRET_KEY_PATTERN = /(key|token|secret|password|authorization|env)/i

// High-confidence credential shapes. Ordered longest-prefix-first so overlapping
// matches mask the full token. Each alternative is anchored to a known vendor
// prefix to avoid masking ordinary prose.
const CREDENTIAL_VALUE_PATTERN = new RegExp(
  [
    'sk-[A-Za-z0-9_-]{8,}', // OpenAI / Anthropic style
    'ghp_[A-Za-z0-9]{20,}', // GitHub personal access token
    'xoxb-[A-Za-z0-9-]{10,}', // Slack bot token
    'AKIA[A-Z0-9]{12,}', // AWS access key id
    'Bearer\\s+[A-Za-z0-9._-]{8,}', // Authorization bearer header value
  ].join('|'),
  'g',
)

const REDACTED = '[REDACTED]'

export function redactString(value: string): string {
  return value.replace(CREDENTIAL_VALUE_PATTERN, REDACTED)
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') return redactString(value)
  if (Array.isArray(value)) return value.map(redactValue)
  if (value && typeof value === 'object') {
    return redact(value as Record<string, unknown>)
  }
  return value
}

export function redact(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(payload)) {
    out[k] = SECRET_KEY_PATTERN.test(k) ? REDACTED : redactValue(v)
  }
  return out
}
