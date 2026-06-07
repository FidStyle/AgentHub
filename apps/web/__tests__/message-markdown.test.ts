import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { RuntimeMessagePart } from '@agenthub/shared'
import { normalizeMessageMarkdown } from '@/lib/chat/markdown'
import { MessageContent } from '@/components/workspace/MessageContent'
import { MessageMarkdown } from '@/components/workspace/MessageMarkdown'
import { MobileActionCard, mobileActionDetailRows, mobileActionStatusText, type MobilePermissionAction } from '@/app/m/sessions/[sessionId]/mobile-permission-readback'

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
    expect(html).toContain('aria-label="引用代码"')
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

  it('mobile session readback fails closed instead of silently rendering empty messages', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../app/m/sessions/[sessionId]/page.tsx', import.meta.url)),
      'utf8',
    )

    expect(source).toContain("if (!r.ok)")
    expect(source).toContain("throw new Error(detail || '消息读取失败')")
    expect(source).toContain('<StateCard variant="error" title="消息读取失败" description={error} />')
  })

  it('acceptance OpenCLI auth uses a test-token middleware gate instead of document.cookie injection', () => {
    const middlewareSource = readFileSync(
      fileURLToPath(new URL('../middleware.ts', import.meta.url)),
      'utf8',
    )
    const verifierSource = readFileSync(
      fileURLToPath(new URL('../scripts/verify-strict-single-prompt-product-delivery.ts', import.meta.url)),
      'utf8',
    )

    expect(middlewareSource).toContain("process.env.TEST_AUTH_COOKIE_VALUE")
    expect(middlewareSource).toContain("req.nextUrl.searchParams.get('uat_auth')")
    expect(middlewareSource).toContain("response.cookies.set('authjs.session-token'")
    expect(verifierSource).toContain("url.searchParams.set('uat_auth', token)")
    expect(verifierSource).not.toContain('document.cookie =')
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
      {
        id: 'permission-1',
        type: 'permission',
        status: 'pending',
        actionId: 'action-1',
        title: '需要执行命令',
        description: '该动作需要授权后继续。',
        riskLevel: 'medium',
        actionKind: 'install_dependency',
        commandPreview: 'pnpm install',
        workspaceRoot: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
        cwd: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
        targetPaths: ['/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/package.json'],
      },
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
    expect(html).toContain('install_dependency')
    expect(html).toContain('pnpm install')
    expect(html).toContain('/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2')
  })

  it('uses approval wording for permission cards instead of execution progress wording', () => {
    const base = {
      id: 'permission-1',
      type: 'permission' as const,
      actionId: 'action-1',
      title: '需要执行命令',
      description: '该动作需要授权后继续。',
      riskLevel: 'medium',
      commandPreview: 'pnpm install',
    }

    const runningHtml = renderToStaticMarkup(createElement(MessageContent, {
      content: '',
      parts: [{ ...base, status: 'running' }],
      streaming: false,
    }))
    const completedHtml = renderToStaticMarkup(createElement(MessageContent, {
      content: '',
      parts: [{ ...base, status: 'completed' }],
      streaming: false,
    }))

    expect(runningHtml).toContain('审批状态：已允许')
    expect(runningHtml).not.toContain('审批状态：执行中')
    expect(completedHtml).toContain('审批状态：已执行')
  })
})

describe('ArtifactPanel frontend contract', () => {
  it('keeps the right workbench split into orchestration, files, Git and user-facing publish artifacts', () => {
    const source = readFileSync(fileURLToPath(new URL('../components/workspace/ArtifactPanel.tsx', import.meta.url)), 'utf8')

    expect(source).toContain("const TABS = ['角色', '过程', '编排', '文件', 'Git', '产物', '部署'] as const")
    expect(source).toContain("'artifact-deployment-timeline' : 'artifact-process-timeline'")
    expect(source).toContain('/api/sessions/${activeSessionId}/timeline')
    expect(source).toContain('data-testid="artifact-orchestration"')
    expect(source).toContain('data-testid="artifact-git"')
    expect(source).toContain('data-testid="workspace-git-tree"')
    expect(source).toContain('workspace-git-file-node')
    expect(source).toContain('data-testid="workspace-git-diff-viewer"')
    expect(source).toContain('data-testid="artifact-publish-panel"')
    expect(source).toContain('data-testid="artifact-publish-start"')
    expect(source).toContain('data-testid="artifact-publish-stop"')
    expect(source).toContain('data-testid="artifact-publish-link"')
    expect(source).toContain('data-testid="artifact-quote-to-composer"')
    expect(source).toContain('引用产物')
    expect(source).toContain('quoteArtifactToComposer')
    expect(source).toContain('产物：${artifact.title}')
    expect(source).toContain('请基于引用的产物')
    expect(source).toContain('/api/artifacts/${artifact.id}/publish')
    expect(source).toContain('启动发布')
    expect(source).toContain('停止发布')
    expect(source).toContain('打开发布链接')
    expect(source).toContain('引用内容')
    expect(source).toContain('data-testid="mini-ide-send-selection-edit"')
    expect(source).toContain('selectionReference')
    expect(source).toContain('suggestedPrompt')
    expect(source).toContain('第 ${start.line}-${end.line} 行')
    expect(source).toContain('确认丢弃')
    expect(source).toContain('workspace-git-commit-button')
    expect(source).toContain('/api/workspaces/${activeWorkspaceId}/git/commit')
    expect(source).toContain('workspace-git-folder-stage-button')
    expect(source).toContain('workspace-git-folder-unstage-button')
    expect(source).toContain('workspace-git-unstage-root-button')
    expect(source).toContain('正式部署请进入「部署」页签')
    expect(source).not.toContain("activeTab === '变更'")
    expect(source).not.toContain('data-testid="artifact-changes"')
    expect(source).not.toContain('data-testid="artifact-launch-panel"')
    expect(source).not.toContain('data-testid="artifact-generate-launch-script"')
    expect(source).not.toContain('data-testid="artifact-start-command"')
    expect(source).not.toContain('复制启动命令')
    expect(source).not.toContain('生成启动脚本')
    expect(source).not.toContain('应用修改')
    expect(source).not.toContain('生成 diff')
    expect(source).not.toContain('替换后的选区内容')
    expect(source).not.toContain('引用选区让 AI 修改')
    expect(source).not.toContain('二次交互编辑')
    expect(source).not.toContain('二次交互迭代')
    expect(source).not.toContain('记录迭代说明')
    expect(source).not.toContain('artifact-edit-request')
    expect(source).not.toContain('edit_request')
    expect(source).not.toContain('查看 diff')
    expect(source).not.toContain('aria-label={`重命名')
    expect(source).not.toContain('运行记录')
    expect(source).not.toContain('允许单次执行')
  })

  it('colors role messages deterministically and keeps file-edit references in the IM composer', () => {
    const chatSource = readFileSync(fileURLToPath(new URL('../components/workspace/ChatPanel.tsx', import.meta.url)), 'utf8')
    const artifactSource = readFileSync(fileURLToPath(new URL('../components/workspace/ArtifactPanel.tsx', import.meta.url)), 'utf8')
    const colorSource = readFileSync(fileURLToPath(new URL('../lib/role-colors.ts', import.meta.url)), 'utf8')

    expect(colorSource).toContain('const ROLE_COLOR_CLASSES')
    expect(colorSource).toContain('const ROLE_BADGE_COLOR_CLASSES')
    expect(colorSource).toContain('export function roleMessageColorClass')
    expect(colorSource).toContain('export function roleBadgeColorClass')
    expect(colorSource).toContain('export function roleAvatarColorClass')
    expect(chatSource).toContain("variant=\"outline\"")
    expect(chatSource).toContain('data-testid="mention-role-btn"')
    expect(chatSource).toContain('data-testid="message-role-badge"')
    expect(chatSource).toContain("role === 'user' ? 'border-l-primary bg-primary/10' : roleMessageColorClass")
    expect(chatSource).toContain('suggestedPrompt')
    expect(chatSource).toContain('const block = quotedText ?')
    expect(chatSource).toContain('quotedText')
    expect(chatSource).toContain("window.addEventListener('agenthub:quote-to-composer'")
    expect(artifactSource).toContain('roleAvatarColorClass')
    expect(artifactSource).toContain('roleBadgeColorClass')
    expect(artifactSource).toContain('roleMessageColorClass')
    expect(artifactSource).toContain('已引用 ${ref.preview}')
  })

  it('adds a publish API that starts and stops runnable artifacts behind the UI buttons', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../app/api/artifacts/[id]/publish/route.ts', import.meta.url)),
      'utf8',
    )

    expect(source).toContain("const action = body.action === 'stop' ? 'stop' : 'start'")
    expect(source).toContain("RUNNABLE_ARTIFACT_TYPES.has(row.artifact_type ?? '')")
    expect(source).toContain('createWorkspaceArtifactLaunchScript(workspaceRoot, row.id, row.source_path)')
    expect(source).toContain('if (!scriptFullPath.startsWith(`${workspaceRoot}${path.sep}`))')
    expect(source).toContain("stdio: ['ignore', 'ignore', 'ignore']")
    expect(source).toContain("publishStatus: 'running'")
    expect(source).toContain('publishUrl: url')
    expect(source).toContain("publishStatus: 'stopped'")
    expect(source).toContain("typeof metadata?.publishPid === 'number'")
    expect(source).toContain("process.kill(storedPid, 'SIGTERM')")
    expect(source).toContain('publishPid: null')
    expect(source).toContain("NextResponse.json({ status: 'running', url")
    expect(source).toContain("NextResponse.json({ status: 'stopped', pid")
  })

  it('keeps the right workbench width draggable and persisted on desktop', () => {
    const source = readFileSync(fileURLToPath(new URL('../components/workspace/WorkspaceShell.tsx', import.meta.url)), 'utf8')

    expect(source).toContain('data-testid="artifact-resize-handle"')
    expect(source).toContain('aria-label="拖动中间分界线调整右侧面板宽度"')
    expect(source).toContain('title="拖动调整右侧工作台宽度"')
    expect(source).toContain('GripVertical')
    expect(source).toContain('RIGHT_PANEL_RESIZER_WIDTH = 12')
    expect(source).toContain("window.localStorage.getItem('agenthub:right-panel-width')")
    expect(source).toContain("window.localStorage.setItem('agenthub:right-panel-width'")
    expect(source).toContain("window.localStorage.getItem('agenthub:right-panel-wide')")
    expect(source).toContain("window.localStorage.setItem('agenthub:right-panel-wide'")
    expect(source).toContain("window.addEventListener('pointermove'")
    expect(source).toContain("window.addEventListener('pointerup'")
    expect(source).toContain('clampRightPanelWidth(window.innerWidth - event.clientX, rightPanelWide)')
    expect(source).toContain('RIGHT_PANEL_WIDE_MAX_WIDTH = 1040')
    expect(source).toContain("lg:grid-cols-[280px_minmax(320px,1fr)_var(--artifact-resizer-width)_var(--artifact-width)]")
    expect(source).toContain("'--artifact-resizer-width': `${RIGHT_PANEL_RESIZER_WIDTH}px`")
    expect(source).not.toContain('absolute -left-1.5 top-0 hidden h-full w-3')
  })

  it('stacks artifact tab icons above labels with compact horizontal padding', () => {
    const source = readFileSync(fileURLToPath(new URL('../components/workspace/ArtifactPanel.tsx', import.meta.url)), 'utf8')
    const tabBlock = source.slice(
      source.indexOf('{TABS.map((tab) => ('),
      source.indexOf('</Button>', source.indexOf('data-testid={`artifact-tab-${tab}`}')) + '</Button>'.length,
    )

    expect(tabBlock).toContain('data-testid={`artifact-tab-${tab}`}')
    expect(tabBlock).toContain('className="h-11 flex-1 flex-col gap-0.5 px-1.5 leading-none"')
    expect(tabBlock).toContain('<span>{tab}</span>')
    expect(tabBlock).toContain('<ShieldCheck className="h-3.5 w-3.5" />')
    expect(tabBlock).not.toContain('mr-1 h-3.5 w-3.5')
  })

  it('renders the workspace file and Git panels as tree-first wide workbench surfaces', () => {
    const source = readFileSync(fileURLToPath(new URL('../components/workspace/ArtifactPanel.tsx', import.meta.url)), 'utf8')

    expect(source).toContain('data-testid="workspace-file-tree"')
    expect(source).toContain('data-testid="workspace-file-viewer"')
    expect(source).toContain('data-testid="workspace-new-file-button"')
    expect(source).toContain('data-testid="workspace-git-tree"')
    expect(source).toContain('data-testid="workspace-git-diff-viewer"')
    expect(source).toContain('data-testid="workspace-git-stage-root-button"')
    expect(source).toContain('data-testid="workspace-git-unstage-root-button"')
    expect(source).toContain('data-testid="workspace-git-commit-button"')
    expect(source).toContain('aria-label="暂存根目录所有未暂存变更"')
    expect(source).toContain('aria-label="取消暂存所有已暂存变更"')
    expect(source).toContain('disabled={unstagedChanges.length === 0}')
    expect(source).toContain('disabled={stagedChanges.length === 0}')
    expect(source).toContain("onClick={() => void runGitAction('stage', '.')}")
    expect(source).toContain("onClick={() => void runGitAction('unstage', '.')}")
    expect(source).toContain("data-testid={isDir ? 'workspace-git-folder-toggle' : 'workspace-git-open-diff'}")
    expect(source).toContain("data-testid={group === 'staged' ? 'workspace-git-unstage-button' : 'workspace-git-stage-button'}")
    expect(source).toContain("data-testid={group === 'staged' ? 'workspace-git-folder-unstage-button' : 'workspace-git-folder-stage-button'}")
    expect(source).toContain("aria-label={group === 'staged' ? `取消暂存 ${node.path}` : `暂存 ${node.path}`}")
    expect(source).toContain("aria-label={group === 'staged' ? `取消暂存目录 ${node.path}` : `暂存目录 ${node.path}`}")
    expect(source).toContain('event.stopPropagation()')
    expect(source).toContain("onQuickAction(group === 'staged' ? 'unstage' : 'stage', node.change!)")
    expect(source).toContain('ancestorDirectoryPaths')
    expect(source).toContain('buildGitChangeTree')
    expect(source).toContain('onRequestWide(true)')
    expect(source).toContain('左侧只显示文件名和状态，点击后才读取具体变更内容')
    expect(source).toContain('current.size > 0 ? current : new Set()')
  })

  it('requires the strict product gate to exercise right panel resizing through OpenCLI', () => {
    const source = readFileSync(fileURLToPath(new URL('../scripts/verify-strict-single-prompt-product-delivery.ts', import.meta.url)), 'utf8')

    expect(source).toContain('verifyWebRightPanelResize')
    expect(source).toContain('const workspaceUrl = opencliAuthenticatedUrl(`/workspace/${workspaceId}`)')
    expect(source).toContain('opencliAuthenticatedUrl(`/workspace/${workspaceId}`)')
    expect(source).toContain("url.searchParams.set('uat_auth', token)")
    expect(source).not.toMatch(/const workspaceUrl = `\$\{BASE_URL\}\/workspaces\/\$\{workspaceId\}`/)
    expect(source).toContain("['browser', 'agenthub-strict', 'open', opencliAuthenticatedUrl(`/workspace/${workspaceId}`)]")
    expect(source).not.toContain("['browser', 'agenthub-strict', 'open', `${BASE_URL}/workspaces/${workspaceId}`]")
    expect(source).toContain("opencli-web-right-panel-resize-drag.txt")
    expect(source).toContain("opencli-web-right-panel-resize-persisted.txt")
    expect(source).toContain("document.querySelector('[data-testid=\"artifact-resize-handle\"]')")
    expect(source).toContain('PointerEvent')
    expect(source).toContain("window.localStorage.getItem('agenthub:right-panel-width')")
    expect(source).toContain('Web 右侧栏可拖动且聊天区仍可用')
    expect(source).toContain('Web 右侧栏宽度刷新后持久化')
  })

  it('requires strict SQLite persistence checks to inspect generated user tables instead of fixed table names', () => {
    const source = readFileSync(fileURLToPath(new URL('../scripts/verify-strict-single-prompt-product-delivery.ts', import.meta.url)), 'utf8')

    expect(source).toContain('sqlitePersistentHistoryEvidence')
    expect(source).toContain("name not like 'sqlite_%'")
    expect(source).toContain('relative.startsWith(\'.test-data\')')
    expect(source).toContain('select count(*) from "${escapedTable}"')
    expect(source).not.toContain('select count(*) from history;')
    expect(source).not.toContain('select count(*) from calculations;')
    expect(source).not.toContain('select count(*) from calculation_history;')
  })
})

describe('IM-first orchestration contract', () => {
  it('requires real role runtime transactions to be persisted back into the IM transcript', () => {
    const source = readFileSync(fileURLToPath(new URL('../app/api/chat/route.ts', import.meta.url)), 'utf8')

    expect(source).toContain('dispatchPreparedRuntimeInvokeNode')
    expect(source).toContain('createRuntimeAttemptEvidence')
    expect(source).toContain('completedReplies.push')
    expect(source).toContain("sender_type: 'agent'")
    expect(source).toContain('role_agent_id: completedReply.roleAgentId')
    expect(source).toContain('handoffsReceived')
    expect(source).toContain("type: 'role_handoff'")
    expect(source).toContain("messageType: 'plan_card'")
    expect(source).toContain('思考中：架构师已接收需求并创建执行计划。')
    expect(source).toContain('分工：架构师负责规划和验收，后端工程师负责 API、SQLite 历史记录与服务验证，前端工程师负责 public/index.html、public/app.js、public/styles.css 和浏览器交互。')
    expect(source).toContain('已完成产物推荐与确认。')
    expect(source).not.toContain("content: '已发布'")
    expect(source).not.toContain("content: '部署完成'")
  })
})

describe('MobileActionCard', () => {
  it('renders durable approved native permission details for Mobile/PWA readback', () => {
    const action: MobilePermissionAction = {
      id: 'action-read-1',
      session_id: 'session-001',
      action_type: 'read_file',
      command: 'Read: /Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/README.md',
      cwd: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
      risk_level: 'low',
      status: 'approved',
      requires_approval: true,
      result: {
        source: 'runtime_permission_broker',
        toolName: 'Read',
        actionKind: 'read_file',
        workspaceRoot: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
        cwd: '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2',
        targetPaths: ['/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/README.md'],
      },
      approved_at: '2026-06-05T00:00:00.000Z',
      created_at: '2026-06-05T00:00:00.000Z',
    }

    const html = renderToStaticMarkup(createElement(MobileActionCard, { action }))

    expect(mobileActionStatusText(action)).toBe('已允许本次执行')
    expect(mobileActionDetailRows(action)).toEqual(expect.arrayContaining([
      ['动作', 'read_file'],
      ['工具', 'Read'],
      ['Workspace', '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2'],
      ['路径', '/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/README.md'],
    ]))
    expect(html).toContain('data-testid="mobile-durable-permission-card"')
    expect(html).toContain('授权记录')
    expect(html).toContain('已允许本次执行')
    expect(html).toContain('Read: /Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/README.md')
    expect(html).toContain('read_file')
    expect(html).toContain('Read')
    expect(html).toContain('/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2')
    expect(html).not.toContain('允许</button>')
    expect(html).not.toContain('拒绝</button>')
  })

  it('keeps pending durable actions actionable on Mobile/PWA', () => {
    const action: MobilePermissionAction = {
      id: 'action-write-1',
      session_id: 'session-001',
      action_type: 'file_write',
      command: 'Write: package.json',
      status: 'pending',
      requires_approval: true,
    }

    const html = renderToStaticMarkup(createElement(MobileActionCard, {
      action,
      onApprove: () => undefined,
    }))

    expect(html).toContain('需要授权')
    expect(html).toContain('允许')
    expect(html).toContain('拒绝')
  })
})
