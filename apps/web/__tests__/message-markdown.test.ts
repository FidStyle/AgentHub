import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { RuntimeMessagePart } from '@agenthub/shared'
import { normalizeMessageMarkdown } from '@/lib/chat/markdown'
import { MessageContent } from '@/components/workspace/MessageContent'
import { MessageMarkdown } from '@/components/workspace/MessageMarkdown'

describe('normalizeMessageMarkdown', () => {
  it('only normalizes CRLF line endings and does not repair Markdown structure', () => {
    const input = '标题\r\n\r\n```markdown\r\n# 一级标题\r\n```\r\n'

    expect(normalizeMessageMarkdown(input)).toBe('标题\n\n```markdown\n# 一级标题\n```\n')
  })

  it('does not rewrite flattened or malformed Markdown text heuristically', () => {
    const input = '说明：- 列表项```typescriptconst value = 1```| A | B || --- | --- |'

    expect(normalizeMessageMarkdown(input)).toBe(input)
  })

  it('preserves fenced markdown examples and nested code fences', () => {
    const input = [
      '下面是 Markdown 的主要格式示例：',
      '',
      '## 标题',
      '',
      '```markdown',
      '# 一级标题',
      '## 二级标题',
      '### 三级标题',
      '```',
      '',
      '## 代码块',
      '',
      '````markdown',
      '```python',
      'def hello():',
      '    print("Hello")',
      '```',
      '````',
    ].join('\n')

    const normalized = normalizeMessageMarkdown(input)
    const html = renderToStaticMarkup(createElement(MessageMarkdown, { content: input }))

    expect(normalized).toContain('````markdown\n```python')
    expect(normalized).toContain('    print("Hello")')
    expect(html).toContain('<h2')
    expect(html).toContain('data-language="markdown"')
    expect(html).toContain('```python')
    expect(html).toContain('print(&quot;Hello&quot;)')
  })

  it('keeps line breaks inside fenced markdown example code blocks', () => {
    const input = [
      '下面是 Markdown 的几种主要格式示例：',
      '## 标题',
      '',
      '```markdown',
      '# 一级标题',
      '## 二级标题',
      '### 三级标题',
      '```',
      '',
      '## 表格',
      '',
      '```markdown',
      '| 列1 | 列2 |',
      '|------|---|',
      '| 单元格 | 单元格 |',
      '```',
    ].join('\n')

    const html = renderToStaticMarkup(createElement(MessageMarkdown, { content: input }))

    expect(html).toContain('data-streamdown="code-block"')
    expect(html).toContain('data-language="markdown"')
    expect(html).toContain('# 一级标题\n## 二级标题\n### 三级标题')
    expect(html).toContain('| 列1 | 列2 |\n|------|---|\n| 单元格 | 单元格 |')
    expect(html).not.toContain('# 一级标题## 二级标题')
    expect(html).not.toContain('| 列1 | 列2 ||------|---|')
    expect(html).not.toContain('<pre><div')
    expect(html).not.toContain('<pre data-streamdown="code-block-body"><div')
  })

  it('renders fenced code blocks without nesting block wrappers inside react-markdown pre nodes', () => {
    const input = ['```markdown', '# 一级标题', '## 二级标题', '```'].join('\n')
    const html = renderToStaticMarkup(createElement(MessageMarkdown, { content: input }))

    expect(html).toContain('<div data-streamdown="code-block"')
    expect(html).toContain('<pre data-streamdown="code-block-body"><code class="language-markdown"># 一级标题\n## 二级标题</code></pre>')
    expect(html).not.toContain('<pre><div')
    expect(html).not.toContain('markdown# 一级标题')
  })

  it('does not leak react-markdown node props into DOM elements', () => {
    const input = [
      '[链接](https://example.com)',
      '',
      '行内代码 `const node = true`',
      '',
      '| 列1 | 列2 |',
      '| --- | --- |',
      '| A | B |',
      '',
      '![图片](https://example.com/image.png)',
    ].join('\n')
    const html = renderToStaticMarkup(createElement(MessageMarkdown, { content: input }))

    expect(html).toContain('<a href="https://example.com"')
    expect(html).toContain('<table>')
    expect(html).toContain('<code')
    expect(html).toContain('<img')
    expect(html).not.toContain('node="[object Object]"')
  })
})

describe('MessageMarkdown', () => {
  it('renders GFM tables, task list checkboxes, blockquote, inline code, fenced code, and separator', () => {
    const input = [
      '# 标题',
      '',
      '> 关键引用',
      '',
      '- [x] 已完成',
      '- [ ] 未完成',
      '',
      '1. 有序项',
      '2. 第二项',
      '',
      '行内代码 `const value = 1`',
      '',
      '```ts',
      'const value = 1',
      'console.log(value)',
      '```',
      '',
      '| 列1 | 列2 |',
      '| --- | --- |',
      '| A | B |',
      '| C | D |',
      '',
      '---',
    ].join('\n')
    const html = renderToStaticMarkup(createElement(MessageMarkdown, { content: input }))

    expect(html).toContain('<h1')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<ul')
    expect(html).toContain('<ol')
    expect(html).toContain('<li')
    expect(html).toContain('class="contains-task-list"')
    expect(html).toContain('class="task-list-item"')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('disabled=""')
    expect(html.match(/type="checkbox"/g)).toHaveLength(2)
    expect(html).toContain('<code')
    expect(html).toContain('<div data-streamdown="code-block"')
    expect(html).toContain('aria-label="复制代码"')
    expect(html).not.toContain('md:group-hover/code-block')
    expect(html).toContain('<pre data-streamdown="code-block-body"><code class="language-ts">const value = 1\nconsole.log(value)</code></pre>')
    expect(html).toContain('<table>')
    expect(html).toContain('<hr')
    expect(html).not.toContain('<pre><div')
    expect(html).not.toContain('<pre data-streamdown="code-block-body"><div')
    expect(html).not.toContain('node="[object Object]"')
  })

  it('renders inline and block math with KaTeX without converting ordinary single dollar text', () => {
    const input = [
      '行内公式 $E = mc^2$。',
      '',
      '$$',
      '\\int_0^1 x^2 dx',
      '$$',
      '',
      '普通价格文本是 $5，不应变成公式。',
    ].join('\n')
    const html = renderToStaticMarkup(createElement(MessageMarkdown, { content: input }))

    expect(html).toContain('class="katex"')
    expect(html).toContain('class="katex-display"')
    expect(html).toContain('普通价格文本是 $5')
    expect(html).not.toContain('普通价格文本是 <span class="katex"')
  })

  it('renders valid Markdown lists through ReactMarkdown', () => {
    const html = renderToStaticMarkup(createElement(MessageMarkdown, {
      content: ['三个文件内容已经准备好：', '', '- `package.json`', '- `server.js`', '- `public/index.html`'].join('\n'),
    }))

    expect(html).toContain('data-testid="message-markdown"')
    expect(html).toContain('<ul')
    expect(html).toContain('<li')
    expect(html).toContain('package.json')
  })

  it('renders markdown images without nesting Streamdown wrapper divs inside paragraphs', () => {
    const html = renderToStaticMarkup(createElement(MessageMarkdown, {
      content: '链接与图片：\n\n![图片描述](https://example.com/image.png)',
    }))

    expect(html).toContain('<img')
    expect(html).not.toContain('<p><div')
    expect(html).not.toContain('data-streamdown="image-wrapper"')
  })

  it('does not render message-level actions inside markdown content', () => {
    const html = renderToStaticMarkup(createElement(MessageMarkdown, {
      content: ['一段说明文字。', '', '- 第一项', '- 第二项', '', '> 关键引用'].join('\n'),
    }))

    expect(html).not.toContain('aria-label="复制整条消息"')
    expect(html).not.toContain('class="flex shrink-0 items-center gap-1"')
    expect(html).not.toContain('opacity-100 shadow-sm transition-opacity md:opacity-0')
    expect(html).not.toContain('message-markdown-actions')
    expect(html).not.toContain('aria-label="复制段落"')
    expect(html).not.toContain('aria-label="复制列表"')
    expect(html).not.toContain('aria-label="复制引用"')
    expect(html).not.toContain('<p><div')
  })

  it('keeps copy and code block layout styles explicit in the global CSS contract', () => {
    const css = readFileSync(fileURLToPath(new URL('../app/globals.css', import.meta.url)), 'utf8')

    expect(css).toContain('.message-markdown .agenthub-markdown')
    expect(css).toContain('padding-right: 0')
    expect(css).not.toContain('.message-markdown-actions')
    expect(css).toContain('.message-markdown ul')
    expect(css).toContain('list-style-type: disc')
    expect(css).toContain('.message-markdown ul ul')
    expect(css).toContain('list-style-type: circle')
    expect(css).toContain('.message-markdown ol')
    expect(css).toContain('list-style-type: decimal')
    expect(css).toContain('.message-markdown .task-list-item')
    expect(css).toContain('list-style: none')
    expect(css).toContain('[data-streamdown="code-block-header"]')
    expect(css).toContain('padding: 0.4rem 0.75rem')
    expect(css).toContain('text-overflow: ellipsis')
    expect(css).toContain('[data-streamdown="code-block-header"] > [data-language]')
    expect(css).toContain('[data-streamdown="code-block-header"] > span:not([data-language])')
    expect(css).toContain('[data-streamdown="code-block-header"] > span:not([data-language]) > button')
    expect(css).toContain('height: 1.75rem')
    expect(css).toContain('[data-streamdown="code-block-body"]')
    expect(css).toContain('padding: 0.75rem')
  })
})

describe('MessageContent', () => {
  it('renders runtime tool and permission parts behind a stable message-content boundary', () => {
    const parts: RuntimeMessagePart[] = [
      { id: 'tool-1', type: 'tool', status: 'completed', toolName: 'git status', result: { changed: 2 } },
      { id: 'permission-1', type: 'permission', status: 'pending', actionId: 'action-1', title: '需要执行命令', description: '该动作需要授权后继续。', riskLevel: 'medium' },
    ]

    const html = renderToStaticMarkup(createElement(MessageContent, {
      content: '执行前检查：- 查看 Git 状态- 等待授权',
      parts,
      streaming: false,
    }))

    expect(html).toContain('data-testid="message-content"')
    expect(html).toContain('data-testid="message-tool-card"')
    expect(html).toContain('data-testid="message-permission-card"')
    expect(html).toContain('工具：git status')
    expect(html).toContain('需要执行命令')
  })
})
