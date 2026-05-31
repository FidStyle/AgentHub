import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DesktopAgentSession } from '../src/renderer/components/shell/DesktopAgentSession'
import { useConsoleStore, type AgentConfig } from '../src/renderer/store/console-store'

const AGENT: AgentConfig = { id: 'codex', name: 'Codex', status: 'connected', version: '0.1.2' }

function resetStore() {
  useConsoleStore.setState({
    selectedAgent: AGENT,
    activities: [],
    workspaceDirs: [{ path: '~/Projects/agenthub', healthy: true }],
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

describe('DesktopAgentSession 真实 runtime 执行（PRGA-002）', () => {
  beforeEach(resetStore)

  it('golden path：发送指令调用真实 runtime.execute，活动状态来自真实 stdout/exitCode', async () => {
    const execute = vi.fn().mockResolvedValue({ exitCode: 0, stdout: 'real-output-xyz', stderr: '', duration: 12 })
    ;(window as unknown as { electronAPI: unknown }).electronAPI = { runtime: { execute, detect: vi.fn(), available: vi.fn() } }

    const user = userEvent.setup()
    render(<DesktopAgentSession />)

    await user.type(screen.getByPlaceholderText('输入指令...'), 'ls -la')
    await user.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    expect(execute).toHaveBeenCalledWith('ls -la', '~/Projects/agenthub')

    // 活动来自真实返回：成功 + stdout 内容
    expect(await screen.findByText(/real-output-xyz/)).toBeInTheDocument()
    expect(screen.getByText('成功')).toBeInTheDocument()
  })

  it('失败路径：exitCode != 0 渲染明确失败错误态（不硬编码 success）', async () => {
    const execute = vi.fn().mockResolvedValue({ exitCode: 2, stdout: '', stderr: 'command not found', duration: 5 })
    ;(window as unknown as { electronAPI: unknown }).electronAPI = { runtime: { execute, detect: vi.fn(), available: vi.fn() } }

    const user = userEvent.setup()
    render(<DesktopAgentSession />)

    await user.type(screen.getByPlaceholderText('输入指令...'), 'badcmd')
    await user.click(screen.getByRole('button', { name: '发送' }))

    await waitFor(() => expect(execute).toHaveBeenCalled())
    expect(await screen.findByText('失败')).toBeInTheDocument()
    expect(screen.getByText(/退出码 2/)).toBeInTheDocument()
    expect(screen.getByText(/command not found/)).toBeInTheDocument()
    // 绝不出现硬编码成功
    expect(screen.queryByText('成功')).not.toBeInTheDocument()
  })

  it('无 runtime：发送后渲染明确失败错误态，且未伪造执行', async () => {
    // window.electronAPI 未设置（runtime 不可用）
    const user = userEvent.setup()
    render(<DesktopAgentSession />)

    await user.type(screen.getByPlaceholderText('输入指令...'), 'ls')
    await user.click(screen.getByRole('button', { name: '发送' }))

    expect(await screen.findByText('失败')).toBeInTheDocument()
    expect(screen.getByText(/runtime 不可用|未检测到/)).toBeInTheDocument()
    expect(screen.queryByText('成功')).not.toBeInTheDocument()
  })
})

describe('DesktopAgentSession 控制按钮（PRGA-003）', () => {
  beforeEach(resetStore)

  it('诊断是明确轻量入口，继续/重试/停止不再常驻成无效果死按钮', () => {
    render(<DesktopAgentSession />)
    const diagnose = screen.getByRole('button', { name: '诊断' })
    expect(diagnose).toBeEnabled()
    expect(diagnose).toHaveAttribute('title')
    expect(diagnose.getAttribute('title') ?? '').toMatch(/doctor|status|诊断/)
    expect(screen.queryByRole('button', { name: '继续' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '停止' })).not.toBeInTheDocument()
  })
})
