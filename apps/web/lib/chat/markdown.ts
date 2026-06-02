const FENCE_PATTERN = /(```[\s\S]*?```)/g

function normalizeMarkdownSegment(segment: string) {
  return segment
    .replace(/([^\n])([ \t]+)(#{1,6}[ \t]+(?=\S))/g, '$1\n$3')
    .replace(/([^\n])([ \t]+)([-*][ \t]+(?=\S))/g, '$1\n$3')
    .replace(/([^\n])([ \t]+)(\d+\.[ \t]+(?=\S))/g, '$1\n$3')
}

export function normalizeMessageMarkdown(content: string) {
  if (!content) return content
  return content
    .split(FENCE_PATTERN)
    .map((segment) => (segment.startsWith('```') ? segment : normalizeMarkdownSegment(segment)))
    .join('')
}
