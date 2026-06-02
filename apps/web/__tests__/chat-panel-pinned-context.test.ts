import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PinnedContextPanel } from '@/components/workspace/ChatPanel'

describe('ChatPanel pinned context panel', () => {
  it('renders pinned context hint and jump targets for pinned session messages', () => {
    const html = renderToStaticMarkup(createElement(PinnedContextPanel, {
      roleName: () => undefined,
      onJumpToMessage: () => undefined,
      pinnedMessages: [
        {
          id: 'msg-pinned',
          sessionId: 'session-001',
          role: 'user',
          content: '关键需求：后续都要保留 Markdown 表格。',
          createdAt: '2026-06-03T00:00:00.000Z',
          roleAgentId: null,
          isPinned: true,
        },
      ],
    }))

    expect(html).toContain('data-testid="pinned-context-panel"')
    expect(html).toContain('固定上下文会在后续回复中持续带给智能体')
    expect(html).toContain('data-testid="pinned-context-jump"')
    expect(html).toContain('关键需求：后续都要保留 Markdown 表格。')
  })
})
