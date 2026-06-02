import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { RuntimeMessagePart } from '@agenthub/shared'
import { appendRuntimeDelta, normalizeMessageMarkdown } from '@/lib/chat/markdown'
import { MessageContent } from '@/components/workspace/MessageContent'
import { MessageMarkdown } from '@/components/workspace/MessageMarkdown'

describe('normalizeMessageMarkdown', () => {
  it('restores block breaks before unordered list markers when model text is flattened', () => {
    const input = '三个文件内容已经准备好： - counter-app/package.json — 仅 express - counter-app/server.js — SQLite 持久化 - counter-app/public/index.html — 前端页面'

    expect(normalizeMessageMarkdown(input)).toBe([
      '三个文件内容已经准备好：',
      '- counter-app/package.json — 仅 express',
      '- counter-app/server.js — SQLite 持久化',
      '- counter-app/public/index.html — 前端页面',
    ].join('\n'))
  })

  it('restores block breaks before ordered list markers', () => {
    const input = '等你授权的三个动作： 1. pnpm add better-sqlite3 2. pnpm add -D @types/better-sqlite3 3. 写 API 路由'

    expect(normalizeMessageMarkdown(input)).toBe([
      '等你授权的三个动作：',
      '1. pnpm add better-sqlite3',
      '2. pnpm add -D @types/better-sqlite3',
      '3. 写 API 路由',
    ].join('\n'))
  })

  it('does not treat plus signs in prose as list markers', () => {
    const input = '本项目用的是 PostgreSQL(pg + drizzle-orm)，前端页面是两个输入框 + 加减按钮。'

    expect(normalizeMessageMarkdown(input)).toBe(input)
  })

  it('does not rewrite fenced code blocks', () => {
    const input = ['说明： - 应渲染为列表', '```', 'const text = "说明： - 不改代码块"', '```'].join('\n')

    expect(normalizeMessageMarkdown(input)).toBe(['说明：', '- 应渲染为列表', '```', 'const text = "说明： - 不改代码块"', '```'].join('\n'))
  })

  it('restores adjacent list markers when streaming removed the spaces before markers', () => {
    const input = '有什么我可以帮你的？比如：- 继续推进某个功能开发或修复- 排查问题、做代码审查- 梳理某块逻辑或架构'

    expect(normalizeMessageMarkdown(input)).toBe([
      '有什么我可以帮你的？',
      '',
      '比如：',
      '- 继续推进某个功能开发或修复',
      '- 排查问题、做代码审查',
      '- 梳理某块逻辑或架构',
    ].join('\n'))
  })

  it('restores tables, task lists, math fences, and compact code fence language lines', () => {
    const input = [
      '代码块：```typescriptfunction greet(name: string): string { return `Hello, ${name}`}```',
      '[这是链接](https://example.com)| 表头 1 | 表头 2 || ------ | ------ || 单元格 | 单元格 |- [x] 已完成任务- [ ] 未完成任务---行内公式 $E = mc^2$，块级公式：$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$',
    ].join('')

    const normalized = normalizeMessageMarkdown(input)

    expect(normalized).toContain('```typescript\nfunction greet')
    expect(normalized).toContain('\n| 表头 1 | 表头 2 |')
    expect(normalized).toContain('\n| ------ | ------ |')
    expect(normalized).toContain('\n| 单元格 | 单元格 |')
    expect(normalized).toContain('\n- [x] 已完成任务')
    expect(normalized).toContain('\n- [ ] 未完成任务')
    expect(normalized).toContain('$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$')
  })

  it('restores a flattened markdown demo into block-level markdown before rendering', () => {
    const input = '下面是常见的 Markdown 主要格式示例：# 一级标题## 二级标题### 三级标题**粗体文本** 和 *斜体文本* 以及 ~~删除线~~> 这是引用块> 可以多行- 无序列表项 1- 无序列表项 2  - 嵌套子项1. 有序列表项 12. 有序列表项 2行内代码：`const x = 1`代码块：```typescriptfunction greet(name: string): string { return `Hello, ${name}`}```[这是链接](https://example.com)| 表头 1 | 表头 2 || ------ | ------ || 单元格 | 单元格 |- [x] 已完成任务- [ ] 未完成任务---行内公式 $E = mc^2$，块级公式：$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$'

    const normalized = normalizeMessageMarkdown(input)
    const html = renderToStaticMarkup(createElement(MessageMarkdown, { content: input }))

    expect(normalized).toContain('\n# 一级标题')
    expect(normalized).toContain('\n## 二级标题')
    expect(normalized).toContain('\n### 三级标题')
    expect(normalized).toContain('\n> 这是引用块')
    expect(normalized).toContain('\n> 可以多行')
    expect(normalized).toContain('\n- 无序列表项 1')
    expect(normalized).toContain('\n1. 有序列表项 1')
    expect(normalized).toContain('```typescript\nfunction greet')
    expect(html).toContain('<h1')
    expect(html).toContain('<blockquote')
    expect(html).toContain('<table')
    expect(html).toContain('<code')
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
})

describe('appendRuntimeDelta', () => {
  it('does not append a replayed full answer after incremental deltas', () => {
    let content = ''
    for (const delta of [
      '你好！我是 AgentHub 架构师，',
      '负责理解你的需求。',
      '当前你的工作区是 `apps/web`，',
      'git 状态里有两处改动待处理：',
      '\n\n- `public/sw.js`（已修改，未提交）',
      '\n- `__tests__/service-worker.test.ts`（新增的 Service Worker 测试）',
    ]) {
      content = appendRuntimeDelta(content, delta)
    }

    content = appendRuntimeDelta(content, '你好！我是 AgentHub 架构师，负责理解你的需求。当前你的工作区是 `apps/web`,git 状态里有两处改动待处理：- `public/sw.js`（已修改，未提交）- `__tests__/service-worker.test.ts`（新增的 Service Worker 测试）')

    expect(content.match(/你好！我是 AgentHub/g)).toHaveLength(1)
    expect(content.match(/public\/sw\.js/g)).toHaveLength(1)
  })

  it('skips short replay chunks after a completed answer', () => {
    let content = [
      '作为 @架构师，我给你输出几种常见的 Markdown 主要格式示例：',
      '',
      '# 一级标题',
      '',
      '- 第一项',
      '- 第二项',
      '',
      '需要我针对某种格式展开说明吗？',
    ].join('\n')

    for (const delta of ['作为 @架构', '师，我给', '你输出几种常见的 Markdown', '主要格式示例：', '# 一级标题', '- 第一项']) {
      content = appendRuntimeDelta(content, delta)
    }

    expect(content.match(/作为 @架构师/g)).toHaveLength(1)
    expect(content.match(/一级标题/g)).toHaveLength(1)
    expect(content.match(/第一项/g)).toHaveLength(1)
  })
})

describe('MessageMarkdown', () => {
  it('renders normalized flattened lists through Streamdown', () => {
    const html = renderToStaticMarkup(createElement(MessageMarkdown, {
      content: '三个文件内容已经准备好：- `package.json`- `server.js`- `public/index.html`',
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
