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
const COMPACT_KNOWN_FENCE_PATTERN = new RegExp(`\\\`\\\`\\\`(${KNOWN_FENCE_LANGUAGES})([^\\n\\\`][\\s\\S]*?)\\\`\\\`\\\``, 'gi')
const COMPACT_KNOWN_FENCE_OPEN_PATTERN = new RegExp(`(^|[^\\\`])\\\`\\\`\\\`(${KNOWN_FENCE_LANGUAGES})(?=(${FENCE_CODE_START_PATTERN.source.slice(2, -1)}))`, 'gi')

type MarkdownSegment = {
  fenced: boolean
  value: string
}

function splitMarkdownFenceSegments(content: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = []
  const lines = content.match(/[^\n]*\n?|$/g)?.filter((line) => line.length > 0) ?? [content]
  let textBuffer = ''
  let fenceBuffer = ''
  let fenceChar: '`' | '~' | null = null
  let fenceLength = 0

  const flushText = () => {
    if (!textBuffer) return
    segments.push({ fenced: false, value: textBuffer })
    textBuffer = ''
  }

  const flushFence = () => {
    if (!fenceBuffer) return
    segments.push({ fenced: true, value: fenceBuffer })
    fenceBuffer = ''
    fenceChar = null
    fenceLength = 0
  }

  for (const line of lines) {
    if (fenceChar) {
      fenceBuffer += line
      const closeMatch = line.match(/^([`~]{3,})[ \t]*$/)
      if (closeMatch && closeMatch[1][0] === fenceChar && closeMatch[1].length >= fenceLength) {
        flushFence()
      }
      continue
    }

    const openMatch = line.match(/^([`~]{3,})([^\n]*)/)
    if (openMatch) {
      flushText()
      fenceChar = openMatch[1][0] as '`' | '~'
      fenceLength = openMatch[1].length
      fenceBuffer = line
      const closesOnSameLine = new RegExp(`^${fenceChar}{${fenceLength},}[^\\n]*${fenceChar}{${fenceLength},}[ \\t]*$`).test(line)
      if (closesOnSameLine) flushFence()
      continue
    }

    textBuffer += line
  }

  if (fenceBuffer) flushFence()
  flushText()
  return segments
}

function normalizeCompactFence(segment: string) {
  return segment
    .replace(COMPACT_KNOWN_FENCE_PATTERN, (_match, language: string, body: string) => {
      const trimmedBody = body.trimStart()
      if (!FENCE_CODE_START_PATTERN.test(trimmedBody)) return _match
      return `\`\`\`${language}\n${body}\n\`\`\`\n`
    })
    .replace(COMPACT_KNOWN_FENCE_OPEN_PATTERN, '$1```$2\n')
}

function normalizeMarkdownTextSegment(segment: string) {
  return normalizeCompactFence(segment)
    .replace(/([^\n])```/g, '$1\n```')
    .replace(/([。！？?])([^\s\n`*_#-]{1,12}[：:])/g, '$1\n\n$2')
    .replace(/([^\n#])([ \t]*)(#{1,6}[ \t]+(?=\S))/g, '$1\n$3')
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
    .replace(/([a-zA-Z0-9_/`])([，,])([a-zA-Z])/g, '$1$2 $3')
}

export function normalizeMessageMarkdown(content: string) {
  if (!content) return content
  return splitMarkdownFenceSegments(content.replace(/\r\n?/g, '\n'))
    .map((segment) => (segment.fenced ? segment.value : normalizeMarkdownTextSegment(segment.value)))
    .join('')
}
