import { app, BrowserWindow } from 'electron'
import path from 'path'

import type { RuntimeConfigStore as ConfigStoreType } from './runtime/runtime-config-store'
import type { DeviceChannel as DeviceChannelType } from './device-channel'
import type { RuntimeHost as RuntimeHostType } from './runtime/runtime-host'

let deviceChannel: DeviceChannelType | null = null
let runtimeHost: RuntimeHostType | null = null
let configStore: ConfigStoreType | null = null

async function setupRuntime() {
  try {
    const { RuntimeConfigStore } = await import('./runtime/runtime-config-store')
    const { DeviceChannel } = await import('./device-channel')
    const { RuntimeHost } = await import('./runtime/runtime-host')

    configStore = new RuntimeConfigStore()
    deviceChannel = new DeviceChannel()
    runtimeHost = new RuntimeHost()
    runtimeHost.setConfigStore(configStore)
    runtimeHost.setChannel(deviceChannel)
  } catch (err) {
    console.error('Runtime 初始化失败:', err)
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    title: 'AgentHub 桌面连接器',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    const port = process.env.VITE_PORT || '5173'
    win.loadURL(`http://localhost:${port}`)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  await setupRuntime()
  createWindow()
})

app.on('window-all-closed', () => {
  if (deviceChannel) deviceChannel.disconnect()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
