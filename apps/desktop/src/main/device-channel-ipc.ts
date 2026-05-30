import { ipcMain } from 'electron'
import type { DeviceChannel, ConnectionState } from './device-channel'

const CHANNELS = ['device-channel:connect', 'device-channel:disconnect', 'device-channel:state'] as const

function resetDeviceChannelHandlers() {
  for (const channel of CHANNELS) {
    ipcMain.removeHandler(channel)
  }
}

export function registerDeviceChannelHandlers(channel: DeviceChannel) {
  resetDeviceChannelHandlers()
  ipcMain.handle('device-channel:connect', (_e, config: { gatewayUrl: string; deviceToken: string }) => {
    channel.connect(config)
    return channel.getState()
  })
  ipcMain.handle('device-channel:disconnect', () => channel.disconnect())
  ipcMain.handle('device-channel:state', () => channel.getState())
}

export function registerUnavailableDeviceChannelHandlers(reason: string) {
  resetDeviceChannelHandlers()
  ipcMain.handle('device-channel:connect', () => {
    throw new Error(`设备通道不可用：${reason}`)
  })
  ipcMain.handle('device-channel:disconnect', () => undefined)
  ipcMain.handle('device-channel:state', (): ConnectionState => 'disconnected')
}
