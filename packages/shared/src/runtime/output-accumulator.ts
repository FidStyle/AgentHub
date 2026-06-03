import type { RuntimeOutputEvent } from './gateway'

function commonRawOverlapLength(left: string, right: string) {
  const max = Math.min(left.length, right.length)
  for (let length = max; length > 0; length--) {
    if (left.slice(-length) === right.slice(0, length)) return length
  }
  return 0
}

export function appendRuntimeDelta(current: string, delta: string) {
  if (!delta) return current
  if (!current) return delta
  if (current.endsWith(delta)) return current

  const overlap = commonRawOverlapLength(current, delta)
  return overlap > 0 ? current + delta.slice(overlap) : current + delta
}

export function createRuntimeOutputAccumulator(initialContent = '') {
  let content = initialContent
  let lastSeq = 0

  return {
    append(eventOrDelta: RuntimeOutputEvent | string) {
      const event: RuntimeOutputEvent = typeof eventOrDelta === 'string'
        ? { type: 'runtime_output', delta: eventOrDelta }
        : eventOrDelta

      if (typeof event.seq === 'number') {
        if (event.seq <= lastSeq) return content
        lastSeq = event.seq
      }

      if (event.mode === 'replace') {
        content = event.delta ?? ''
        return content
      }

      const delta = event.delta ?? ''
      if (event.mode === 'append' || typeof event.seq === 'number') {
        content += delta
        return content
      }

      content = appendRuntimeDelta(content, delta)
      return content
    },
    value() {
      return content
    },
  }
}
