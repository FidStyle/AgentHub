import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DesktopAgentSession } from '../src/renderer/components/shell/DesktopAgentSession'
import { useConsoleStore, type AgentConfig } from '../src/renderer/store/console-store'

const AGENT: AgentConfig = { id: 'codex', name: 'Codex', status: 'connected', version: '0.1.2' }
const CLAUDE_AGENT: AgentConfig = { id: 'claude_code', name: 'Claude Code', status: 'connected', version: '1.2.3' }
const DEFAULT_WORKDIR = '~/.agenthub/workspaces/default'

function resetStore() {
  useConsoleStore.setState({
    selectedAgent: AGENT,
    activities: [],
    runtimes: [{
      type: 'codex',
      available: true,
      version: '0.1.2',
      authenticated: true,
      launchable: true,
      cliPath: '/usr/local/bin/codex',
      diagnosticCode: 'RUNTIME_READY',
      diagnosticMessage: 'Codex 已安装并完成认证',
    }],
    workspaceDirs: [{ path: DEFAULT_WORKDIR, healthy: true }],
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

describe('DesktopAgentSession 真实 runtime 执行（PRGA-002）', () => {
  beforeEach(resetStore)

  it('golden path：发送 Codex 消息调用真实 runtime.execute，活动状态来自真实 stdout/exitCode', async () => {
    const execute = vi.fn().mockResolvedValue({ exitCode: 0, stdout: 'real-output-xyz', stderr: '', duration: 12 })
    ;(window as unknown as { electronAPI: unknown }).electronAPI = { runtime: { execute, detect: vi.fn(), available: vi.fn() } }

    const user = userEvent.setup()
    render(<DesktopAgentSession />)

    await user.type(screen.getByPlaceholderText('输入给 Codex 的消息...'), 'hello')
    await user.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    expect(execute).toHaveBeenCalledWith({ runtimeType: 'codex', prompt: 'hello' }, DEFAULT_WORKDIR)

    // 活动来自真实返回：成功 + stdout 内容
    expect(await screen.findByText(/real-output-xyz/)).toBeInTheDocument()
    expect(screen.getByText('成功')).toBeInTheDocument()
  })

  it('失败路径：exitCode != 0 渲染明确失败错误态（不硬编码 success）', async () => {
    const execute = vi.fn().mockResolvedValue({ exitCode: 2, stdout: '', stderr: '未找到 Codex CLI，请先完成安装和诊断', duration: 5 })
    ;(window as unknown as { electronAPI: unknown }).electronAPI = { runtime: { execute, detect: vi.fn(), available: vi.fn() } }

    const user = userEvent.setup()
    render(<DesktopAgentSession />)

    await user.type(screen.getByPlaceholderText('输入给 Codex 的消息...'), 'hello')
    await user.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => expect(execute).toHaveBeenCalled())
    expect(await screen.findByText('失败')).toBeInTheDocument()
    expect(screen.getAllByText(/未找到 Codex CLI/).length).toBeGreaterThan(0)
    // 绝不出现硬编码成功
    expect(screen.queryByText('成功')).not.toBeInTheDocument()
  })

  it('Claude Code：发送消息时使用 claude_code runtime 类型', async () => {
    useConsoleStore.setState({
      selectedAgent: CLAUDE_AGENT,
      runtimes: [{
        type: 'claude_code',
        available: true,
        version: '1.2.3',
        authenticated: true,
        launchable: true,
        cliPath: '/usr/local/bin/claude',
        diagnosticCode: 'RUNTIME_READY',
        diagnosticMessage: 'Claude Code 已安装并完成认证',
      }],
      activities: [],
      workspaceDirs: [{ path: DEFAULT_WORKDIR, healthy: true }],
    })
    const execute = vi.fn().mockResolvedValue({ exitCode: 0, stdout: 'claude-output', stderr: '', duration: 12 })
    ;(window as unknown as { electronAPI: unknown }).electronAPI = { runtime: { execute, detect: vi.fn(), available: vi.fn() } }

    const user = userEvent.setup()
    render(<DesktopAgentSession />)

    await user.type(screen.getByPlaceholderText('输入给 Claude Code 的消息...'), 'hello')
    await user.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => expect(execute).toHaveBeenCalledWith({ runtimeType: 'claude_code', prompt: 'hello' }, DEFAULT_WORKDIR))
  })

  it('无 runtime：发送后渲染明确失败错误态，且未伪造执行', async () => {
    // window.electronAPI 未设置（runtime 不可用）
    const user = userEvent.setup()
    render(<DesktopAgentSession />)

    await user.type(screen.getByPlaceholderText('输入给 Codex 的消息...'), 'hello')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('失败')).toBeInTheDocument()
    expect(screen.getByText(/runtime 不可用|未检测到/)).toBeInTheDocument()
    expect(screen.queryByText('成功')).not.toBeInTheDocument()
  })

  it('发送中可以停止当前本地 Runtime 请求', async () => {
    const execute = vi.fn(() => new Promise(() => undefined))
    const cancel = vi.fn().mockResolvedValue(true)
    ;(window as unknown as { electronAPI: unknown }).electronAPI = { runtime: { execute, cancel, detect: vi.fn(), available: vi.fn() } }

    const user = userEvent.setup()
    render(<DesktopAgentSession />)

    await user.type(screen.getByPlaceholderText('输入给 Codex 的消息...'), 'hello')
    await user.click(screen.getByRole('button', { name: '发送' }))
    const stop = await screen.findByRole('button', { name: '停止' })
    expect(stop).toBeEnabled()

    await user.click(stop)
    await waitFor(() => expect(cancel).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/已发送停止请求/)).toBeInTheDocument()
  })
})

describe('DesktopAgentSession 控制按钮（PRGA-003）', () => {
  beforeEach(resetStore)

  it('诊断是明确轻量入口，继续/重试/停止不再常驻成无效果死按钮', async () => {
    const detect = vi.fn().mockResolvedValue([{
      type: 'codex',
      available: true,
      version: '0.1.2',
      authenticated: true,
      launchable: true,
      cliPath: '/usr/local/bin/codex',
      diagnosticCode: 'RUNTIME_READY',
      diagnosticMessage: 'Codex 已安装并完成认证',
    }])
    ;(window as unknown as { electronAPI: unknown }).electronAPI = { runtime: { execute: vi.fn(), detect, available: vi.fn() } }
    const user = userEvent.setup()
    render(<DesktopAgentSession />)
    const diagnose = screen.getByRole('button', { name: '诊断' })
    expect(diagnose).toBeEnabled()
    expect(diagnose).toHaveAttribute('title')
    expect(diagnose.getAttribute('title') ?? '').toMatch(/doctor|status|诊断/)
    await user.click(diagnose)
    await waitFor(() => expect(detect).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/本地 Runtime 诊断完成/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '继续' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '停止' })).not.toBeInTheDocument()
  })
})
