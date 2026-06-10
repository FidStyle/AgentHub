import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DesktopSettingsPage } from '../src/renderer/components/shell/DesktopSettingsPage'
import { useConsoleStore } from '../src/renderer/store/console-store'

const runtimeApi = vi.hoisted(() => ({
  workspaceRoots: vi.fn(),
  addWorkspaceRoot: vi.fn(),
  chooseWorkspaceRoot: vi.fn(),
}))

vi.mock('../src/renderer/utils/electron-api', () => ({
  getRuntimeApi: () => runtimeApi,
}))

function resetStore() {
  useConsoleStore.setState({
    deviceName: 'MacBook Pro',
    userName: 'joytion',
    connectionState: 'connected',
    webWorkspaceError: null,
    authError: null,
    user: { id: 'user-1', name: 'joytion', email: 'joytion@example.com', image: null },
  })
}

describe('DesktopSettingsPage', () => {
  beforeEach(() => {
    resetStore()
    runtimeApi.workspaceRoots.mockReset()
    runtimeApi.addWorkspaceRoot.mockReset()
    runtimeApi.chooseWorkspaceRoot.mockReset()
    runtimeApi.workspaceRoots.mockResolvedValue([
      { path: '/Users/joytion/.agenthub/cloud-workspaces', healthy: true, source: 'default' },
    ])
    runtimeApi.addWorkspaceRoot.mockResolvedValue([
      { path: '/Users/joytion/.agenthub/cloud-workspaces', healthy: true, source: 'default' },
      { path: '/tmp/agenthub-local', healthy: true, source: 'user' },
    ])
  })

  it('renders and updates Desktop-authorized workspace roots', async () => {
    render(<DesktopSettingsPage />)

    expect(screen.getByTestId('desktop-settings-item-workspace-roots')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('/Users/joytion/.agenthub/cloud-workspaces')).toBeInTheDocument())
    expect(screen.getByText(/云端工作区默认使用 ~\/.agenthub\/cloud-workspaces/)).toBeInTheDocument()

    const input = screen.getByPlaceholderText('~/.agenthub/cloud-workspaces')
    fireEvent.change(input, { target: { value: '/tmp/agenthub-local' } })
    fireEvent.click(screen.getByText('添加目录'))

    await waitFor(() => expect(runtimeApi.addWorkspaceRoot).toHaveBeenCalledWith('/tmp/agenthub-local'))
    expect(await screen.findByText('/tmp/agenthub-local')).toBeInTheDocument()
    expect(screen.getByText('已更新 Desktop 授权目录。')).toBeInTheDocument()
  })
})
