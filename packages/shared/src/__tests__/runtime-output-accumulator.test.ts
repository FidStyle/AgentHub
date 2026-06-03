import { describe, expect, it } from 'vitest'
import { appendRuntimeDelta, createRuntimeOutputAccumulator } from '../runtime/output-accumulator'

describe('createRuntimeOutputAccumulator', () => {
  it('preserves a full markdown document exactly across sequenced append fragments', () => {
    const accumulator = createRuntimeOutputAccumulator()
    const chunks = [
      '# 标题\n\n> 引用段落\n\n',
      '- 第一项\n- [x] 已完成\n- [ ] 未完成\n\n',
      '```ts\nconst value = "$5 is text";\nconsole.log(value)\n```\n\n',
      '| 列 A | 列 B |\n| --- | --- |\n| 1 | 2 |\n\n',
      '---\n\n行内公式 $E = mc^2$\n\n$$\n\\int_0^1 x^2 dx\n$$',
    ]
    const expected = chunks.join('')

    chunks.forEach((delta, index) => {
      accumulator.append({ type: 'runtime_output', delta, mode: 'append', seq: index + 1 })
    })

    expect(accumulator.value()).toBe(expected)
    expect(accumulator.value().match(/# 标题/g)).toHaveLength(1)
    expect(accumulator.value().match(/```ts/g)).toHaveLength(1)
    expect(accumulator.value()).toContain('$E = mc^2$')
    expect(accumulator.value()).toContain('$$\n\\int_0^1 x^2 dx\n$$')
  })

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

  it('does not collapse repeated markdown fence characters across sequenced chunks', () => {
    const accumulator = createRuntimeOutputAccumulator()

    accumulator.append({ type: 'runtime_output', delta: '## 列表\n\n`', mode: 'append', seq: 1 })
    accumulator.append({ type: 'runtime_output', delta: '``markdown\n- 无序列表项\n', mode: 'append', seq: 2 })
    accumulator.append({ type: 'runtime_output', delta: '```\n', mode: 'append', seq: 3 })

    expect(accumulator.value()).toBe('## 列表\n\n```markdown\n- 无序列表项\n```\n')
    expect(accumulator.value()).not.toMatch(/(^|\n)``markdown/)
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
