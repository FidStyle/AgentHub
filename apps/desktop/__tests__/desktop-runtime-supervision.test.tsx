import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { DesktopRuntimeSupervision } from '../src/renderer/components/shell/DesktopRuntimeSupervision'
import { useConsoleStore, type AgentConfig } from '../src/renderer/store/console-store'

const CODEX_AGENT: AgentConfig = { id: 'codex', name: 'Codex', status: 'connected', version: '0.135.0' }
const CLAUDE_AGENT: AgentConfig = { id: 'claude_code', name: 'Claude Code', status: 'pending' }
const DEFAULT_WORKDIR = '~/.agenthub/workspaces/default'

function resetStore() {
  useConsoleStore.setState({
    agents: [CODEX_AGENT, CLAUDE_AGENT, { id: 'opencode', name: 'OpenCode', status: 'pending' }],
    runtimes: [{
      type: 'codex',
      available: true,
      version: '0.135.0',
      authenticated: true,
      launchable: true,
      cliPath: '/Users/me/.nvm/versions/node/bin/codex',
      diagnosticCode: 'RUNTIME_READY',
      diagnosticMessage: 'Codex 已安装并完成认证',
    }, {
      type: 'claude_code',
      available: true,
      version: '2.1.148',
      authenticated: false,
      launchable: false,
      cliPath: '/Users/me/.nvm/versions/node/bin/claude',
      diagnosticCode: 'RUNTIME_AUTH_REQUIRED',
      diagnosticMessage: 'Claude Code 未登录或认证不可用，请在本机 CLI 完成登录',
    }],
    nativeSessions: {
      [`codex:${DEFAULT_WORKDIR}`]: {
        key: `codex:${DEFAULT_WORKDIR}`,
        runtimeType: 'codex',
        runtimeName: 'Codex',
        cwd: DEFAULT_WORKDIR,
        nativeSessionId: 'native-codex-123',
        updatedAt: '14:42:00',
      },
    },
  })
}

describe('DesktopRuntimeSupervision', () => {
  beforeEach(resetStore)

  it('展示机器 runtime doctor、角色调度健康和 native session 续接状态', () => {
    render(<DesktopRuntimeSupervision />)

    const panel = screen.getByTestId('desktop-runtime-supervision')
    expect(within(panel).getByText('Runtime 监督')).toBeInTheDocument()
    expect(within(panel).getByText('Codex 已安装并完成认证')).toBeInTheDocument()
    expect(within(panel).getByText('Claude Code 未登录或认证不可用，请在本机 CLI 完成登录')).toBeInTheDocument()
    expect(within(panel).getByText('native-codex-123')).toBeInTheDocument()
    expect(within(panel).getByText(DEFAULT_WORKDIR)).toBeInTheDocument()
    expect(within(panel).getByText('可续接')).toBeInTheDocument()
    expect(within(panel).getByText('不可调度')).toBeInTheDocument()
  })

  it('本地 runtime 监督面不渲染 API Key 或 Base URL 输入入口', () => {
    render(<DesktopRuntimeSupervision />)

    expect(screen.queryByText(/API Key/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/OPENAI_API_KEY|ANTHROPIC_API_KEY/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Base URL/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
