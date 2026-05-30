import { app, BrowserWindow, shell } from 'electron'
import path from 'path'

import type { RuntimeConfigStore as ConfigStoreType } from './runtime/runtime-config-store'
import type { DeviceChannel as DeviceChannelType } from './device-channel'
import type { RuntimeHost as RuntimeHostType } from './runtime/runtime-host'

let deviceChannel: DeviceChannelType | null = null
let runtimeHost: RuntimeHostType | null = null
let configStore: ConfigStoreType | null = null
let pendingDeepLinkUrl: string | null = null

async function setupRuntime() {
  const { RuntimeHost } = await import('./runtime/runtime-host')
  runtimeHost = new RuntimeHost()

  const { registerRuntimeIPC } = await import('./runtime/ipc')
  registerRuntimeIPC()

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
    win.loadFile(path.join(__dirname, '../../renderer/index.html'))
  }

  win.webContents.once('did-finish-load', () => {
    if (pendingDeepLinkUrl) {
      handleDeepLinkUrl(pendingDeepLinkUrl)
      pendingDeepLinkUrl = null
    }
  })
}

function registerProtocolHandler() {
  if (app.isPackaged) {
    app.setAsDefaultProtocolClient('agenthub')
    return
  }

  app.setAsDefaultProtocolClient('agenthub', process.execPath, [path.resolve(process.argv[1] ?? '.')])
}

function findDeepLinkArg(argv: string[]) {
  return argv.find((arg) => arg.startsWith('agenthub://')) ?? null
}

function focusMainWindow() {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return null
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  return win
}

function handleDeepLinkUrl(url: string) {
  try {
    const parsed = new URL(url)
    const isAuthBind =
      parsed.protocol === 'agenthub:' &&
      ((parsed.hostname === 'auth' && parsed.pathname === '/bind') || parsed.pathname === '//auth/bind')

    if (!isAuthBind) return

    const code = parsed.searchParams.get('code')
    if (!code) return

    const win = focusMainWindow()
    if (win) {
      win.webContents.send('device-bind', { code })
    } else {
      pendingDeepLinkUrl = url
    }
  } catch { /* ignore malformed urls */ }
}

const singleInstanceLock = app.requestSingleInstanceLock()

if (!singleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const deepLinkUrl = findDeepLinkArg(argv)
    if (deepLinkUrl) handleDeepLinkUrl(deepLinkUrl)
    focusMainWindow()
  })
}

app.whenReady().then(async () => {
  registerProtocolHandler()
  await setupRuntime()
  createWindow()
})

app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLinkUrl(url)
})

app.on('window-all-closed', () => {
  if (deviceChannel) deviceChannel.disconnect()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
