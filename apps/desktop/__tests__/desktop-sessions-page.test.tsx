import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DesktopSessionsPage } from '../src/renderer/components/shell/DesktopSessionsPage'
import { useConsoleStore, type AgentConfig } from '../src/renderer/store/console-store'

const CODEX: AgentConfig = { id: 'codex', name: 'Codex', status: 'connected' }

describe('DesktopSessionsPage 最近会话', () => {
  beforeEach(() => {
    useConsoleStore.setState({
      selectedAgent: null,
      agents: [CODEX, { id: 'claude_code', name: 'Claude Code', status: 'pending' }],
      activities: [],
    })
  })

  it('没有本地 Runtime 消息时展示明确空态', () => {
    render(<DesktopSessionsPage />)

    expect(screen.getByTestId('desktop-empty-sessions')).toHaveTextContent('暂无本地 Runtime 会话')
    expect(screen.getByText(/发送消息后/)).toBeInTheDocument()
  })

  it('只把 Codex / Claude Code 一次性消息列为最近会话，并可回到会话', async () => {
    useConsoleStore.setState({
      activities: [
        { id: 'boot', time: '09:00:00', type: 'runtime', status: 'success', message: '连接器已启动' },
        { id: 'codex-1', time: '09:01:00', type: 'runtime', status: 'success', message: '[Codex] 你是谁\n我是 Codex' },
      ],
    })

    const user = userEvent.setup()
    render(<DesktopSessionsPage />)

    expect(screen.getAllByTestId('desktop-recent-session')).toHaveLength(1)
    expect(screen.getByText('Codex')).toBeInTheDocument()
    expect(screen.getByText('你是谁')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '回到会话' }))
    expect(useConsoleStore.getState().selectedAgent?.id).toBe('codex')
    expect(useConsoleStore.getState().currentPage).toBe('workspace')
  })
})
