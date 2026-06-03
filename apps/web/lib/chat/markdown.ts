export function normalizeMessageMarkdown(content: string) {
  return content ? content.replace(/\r\n?/g, '\n') : content
}
