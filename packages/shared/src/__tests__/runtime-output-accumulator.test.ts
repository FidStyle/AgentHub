import { describe, expect, it } from 'vitest'
import { appendRuntimeDelta, createRuntimeOutputAccumulator } from '../runtime/output-accumulator'

describe('createRuntimeOutputAccumulator', () => {
  it('appends protocol runtime output in seq order and ignores replayed chunks', () => {
    const accumulator = createRuntimeOutputAccumulator()

    expect(accumulator.append({ type: 'runtime_output', delta: '下面是 Markdown ', mode: 'append', seq: 1 })).toBe('下面是 Markdown ')
    expect(accumulator.append({ type: 'runtime_output', delta: '的主要格式示例：\n\n', mode: 'append', seq: 2 })).toBe('下面是 Markdown 的主要格式示例：\n\n')
    expect(accumulator.append({ type: 'runtime_output', delta: '# 一级标题\n', mode: 'append', seq: 3 })).toBe('下面是 Markdown 的主要格式示例：\n\n# 一级标题\n')

    expect(accumulator.append({ type: 'runtime_output', delta: '下面是 Markdown ', mode: 'append', seq: 1 })).toBe('下面是 Markdown 的主要格式示例：\n\n# 一级标题\n')
    expect(accumulator.value().match(/下面是 Markdown/g)).toHaveLength(1)
  })

  it('replaces content when runtime sends a replacement snapshot', () => {
    const accumulator = createRuntimeOutputAccumulator('旧内容')

    expect(accumulator.append({ type: 'runtime_output', delta: '完整新内容', mode: 'replace', seq: 1 })).toBe('完整新内容')
    expect(accumulator.append({ type: 'runtime_output', delta: ' + 追加', mode: 'append', seq: 2 })).toBe('完整新内容 + 追加')
  })

  it('keeps backward-compatible append semantics for legacy events without seq', () => {
    const accumulator = createRuntimeOutputAccumulator()

    expect(accumulator.append('Hello ')).toBe('Hello ')
    expect(accumulator.append({ type: 'runtime_output', delta: 'World' })).toBe('Hello World')
  })

  it('keeps raw markdown characters when whitespace-normalized overlap looks similar', () => {
    const current = '```markdown\n标题 a b'
    const delta = 'ab\n## 二级标题\n```'

    expect(appendRuntimeDelta(current, delta)).toBe('```markdown\n标题 a bab\n## 二级标题\n```')
  })
})
