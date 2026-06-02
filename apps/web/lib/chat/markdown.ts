const FENCE_PATTERN = /(```[\s\S]*?```)/g
const FENCE_LANGUAGE_PATTERN = /^```([A-Za-z][A-Za-z0-9_+#.-]*)([^\n`][\s\S]*?)```$/
const FENCE_CODE_START_PATTERN = /^(function|const|let|var|class|interface|type|export|import|return|async|def|from|package|func|public|private|protected|SELECT|WITH|INSERT|UPDATE|DELETE|\{|\(|<)/
const KNOWN_FENCE_LANGUAGES = [
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'python',
  'bash',
  'shell',
  'json',
  'html',
  'css',
  'sql',
  'go',
  'java',
  'rust',
].join('|')
const COMPACT_KNOWN_FENCE_PATTERN = new RegExp(`^\\\`\\\`\\\`(${KNOWN_FENCE_LANGUAGES})([^\\n\\\`][\\s\\S]*?)\\\`\\\`\\\`$`, 'i')
const COMPACT_KNOWN_FENCE_OPEN_PATTERN = new RegExp(`\\\`\\\`\\\`(${KNOWN_FENCE_LANGUAGES})(?=(function|const|let|var|class|interface|type|export|import|return|async|def|from|package|func|public|private|protected|SELECT|WITH|INSERT|UPDATE|DELETE|\\{|\\(|<))`, 'gi')

function normalizeFenceSegment(segment: string) {
  const knownLanguageMatch = segment.match(COMPACT_KNOWN_FENCE_PATTERN)
  if (knownLanguageMatch) {
    return `\`\`\`${knownLanguageMatch[1]}\n${knownLanguageMatch[2]}\n\`\`\`\n`
  }
  return segment.replace(FENCE_LANGUAGE_PATTERN, (match, language: string, body: string) => {
    const trimmedBody = body.trimStart()
    if (!FENCE_CODE_START_PATTERN.test(trimmedBody)) return match
    return `\`\`\`${language}\n${body}\n\`\`\`\n`
  })
}

function normalizeMarkdownSegment(segment: string) {
  return segment
    .replace(COMPACT_KNOWN_FENCE_OPEN_PATTERN, '```$1\n')
    .replace(/([^\n])([ \t]*)(#{1,6}[ \t]+(?=\S))/g, '$1\n$3')
    .replace(/([^\n])([ \t]*)(\|[ \t]*[^|\n]+[ \t]*\|[^\n]*\|)/g, '$1\n$3')
    .replace(/(\|[^\n]*\|)([ \t]*)(\|[ \t]*:?-{2,}:?[ \t]*\|[^\n]*\|)/g, '$1\n$3')
    .replace(/(\|[^\n]*\|)([ \t]*)(\|[ \t]*[^|\n]+[ \t]*\|[^\n]*\|)/g, '$1\n$3')
    .replace(/([^\n])([ \t]*)(>[ \t]+(?=\S))/g, '$1\n$3')
    .replace(/([^\n*])([ \t]*)([-*][ \t]+(?=[^\s|]))/g, '$1\n$3')
    .replace(/([^\n])([ \t])(\d)([2-9]\.[ \t]+(?=\S))/g, '$1$2$3\n$4')
    .replace(/([^\n])([ \t]*)(\d+\.[ \t]+(?=\S))/g, '$1\n$3')
    .replace(/([：:])([ \t]*)(\$\$)/g, '$1\n\n$3')
    .replace(/(\$\$)([ \t]*)(\\[A-Za-z])/g, '$1\n$3')
    .replace(/([^\n])([ \t]*)(\$\$)/g, '$1\n$3')
    .replace(/([^\n|-])([ \t]*)(---)(?=[^\-\n])/g, '$1\n$3\n')
    .replace(/([。！？；：])([^\s\n`*_#-])/g, '$1\n\n$2')
    .replace(/([a-zA-Z0-9_/`])([，,])([a-zA-Z])/g, '$1$2 $3')
}

function normalizeForOverlap(value: string) {
  return value
    .replace(/\s+/g, '')
    .replace(/[，,]/g, '，')
}

function commonNormalizedOverlapLength(left: string, right: string) {
  const max = Math.min(left.length, right.length)
  for (let length = max; length > 0; length--) {
    const leftSuffix = left.slice(-length)
    const rightPrefix = right.slice(0, length)
    if (normalizeForOverlap(leftSuffix) === normalizeForOverlap(rightPrefix)) return length
  }
  return 0
}

function isLikelyReplay(current: string, delta: string) {
  if (delta.length < 24) return false
  const normalizedCurrent = normalizeForOverlap(current)
  const normalizedDelta = normalizeForOverlap(delta)
  if (!normalizedCurrent || !normalizedDelta) return false
  if (normalizedCurrent.includes(normalizedDelta)) return true
  const sharedPrefix = normalizedDelta.slice(0, Math.min(18, normalizedDelta.length))
  const sharedTail = normalizedDelta.slice(-Math.min(18, normalizedDelta.length))
  return normalizedCurrent.includes(sharedPrefix) && normalizedCurrent.includes(sharedTail)
}

export function appendRuntimeDelta(current: string, delta: string) {
  if (!delta) return current
  if (!current) return delta
  if (current.endsWith(delta)) return current
  if (isLikelyReplay(current, delta)) return current

  const overlap = commonNormalizedOverlapLength(current, delta)
  if (overlap > 0) return current + delta.slice(overlap)

  return current + delta
}

export function normalizeMessageMarkdown(content: string) {
  if (!content) return content
  return content
    .split(FENCE_PATTERN)
    .map((segment) => (segment.startsWith('```') ? normalizeFenceSegment(segment) : normalizeMarkdownSegment(segment)))
    .join('')
    .replace(/([^\n])```/g, '$1\n```')
}
