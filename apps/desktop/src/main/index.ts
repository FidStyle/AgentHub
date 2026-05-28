import { app, BrowserWindow, shell } from 'electron'
import path from 'path'

import type { RuntimeConfigStore as ConfigStoreType } from './runtime/runtime-config-store'
import type { DeviceChannel as DeviceChannelType } from './device-channel'
import type { RuntimeHost as RuntimeHostType } from './runtime/runtime-host'

let deviceChannel: DeviceChannelType | null = null
let runtimeHost: RuntimeHostType | null = null
let configStore: ConfigStoreType | null = null

async function setupRuntime() {
  const { RuntimeHost } = await import('./runtime/runtime-host')
  runtimeHost = new RuntimeHost()

  try {
    const { RuntimeConfigStore } = await import('./runtime/runtime-config-store')
    configStore = new RuntimeConfigStore()
    runtimeHost.setConfigStore(configStore)
  } catch (err) {
    console.error('Runtime 配置初始化失败:', err)
  }

  try {
    const { DeviceChannel } = await import('./device-channel')
    deviceChannel = new DeviceChannel()
    runtimeHost.setChannel(deviceChannel)
  } catch (err) {
    console.error('设备通道初始化失败:', err)
  }
}

function isDevRendererUrl(url: string, port: string) {
  try {
    const parsed = new URL(url)
    return ['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.port === port
  } catch {
    return false
  }
}

function openExternalHttpUrl(url: string) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      shell.openExternal(url)
    }
  } catch {
    console.error('无法打开外部链接:', url)
  }
}

function createWindow() {
  const rendererPort = process.env.VITE_PORT || '5173'
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
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

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalHttpUrl(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (isDev && isDevRendererUrl(url, rendererPort)) return
    event.preventDefault()
    openExternalHttpUrl(url)
  })

  if (isDev) {
    win.loadURL(`http://localhost:${rendererPort}`)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  app.setAsDefaultProtocolClient('agenthub')
  await setupRuntime()
  createWindow()
})

app.on('open-url', (_event, url) => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'agenthub:' && parsed.pathname === '//auth/bind') {
      const code = parsed.searchParams.get('code')
      if (code) {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) win.webContents.send('device-bind', { code })
      }
    }
  } catch { /* ignore malformed urls */ }
})

app.on('window-all-closed', () => {
  if (deviceChannel) deviceChannel.disconnect()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
