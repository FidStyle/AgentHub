import { describe, expect, it, vi, beforeEach } from 'vitest'

const ipc = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  return {
    handlers,
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      }),
      removeHandler: vi.fn((channel: string) => {
        handlers.delete(channel)
      }),
    },
  }
})

vi.mock('electron', () => ({
  ipcMain: ipc.ipcMain,
}))

describe('device channel IPC registration', () => {
  beforeEach(() => {
    ipc.handlers.clear()
    ipc.ipcMain.handle.mockClear()
    ipc.ipcMain.removeHandler.mockClear()
  })

  it('注册 active handlers，preload 调 device-channel:connect 不会变成 no handler', async () => {
    const { registerDeviceChannelHandlers } = await import('../src/main/device-channel-ipc')
    const channel = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      getState: vi.fn(() => 'connecting'),
    }

    registerDeviceChannelHandlers(channel as never)

    const handler = ipc.handlers.get('device-channel:connect')
    expect(handler).toBeTypeOf('function')
    expect(handler?.({}, { gatewayUrl: 'ws://localhost:3000/ws/device', deviceToken: 'token' })).toBe('connecting')
    expect(channel.connect).toHaveBeenCalledWith({ gatewayUrl: 'ws://localhost:3000/ws/device', deviceToken: 'token' })
  })

  it('DeviceChannel 初始化失败时注册 fallback handlers，而不是让 renderer 收到 no handler', async () => {
    const { registerUnavailableDeviceChannelHandlers } = await import('../src/main/device-channel-ipc')
    registerUnavailableDeviceChannelHandlers('ws 模块加载失败')

    expect(ipc.handlers.get('device-channel:state')?.()).toBe('disconnected')
    expect(() => ipc.handlers.get('device-channel:connect')?.()).toThrow('设备通道不可用：ws 模块加载失败')
  })
})
