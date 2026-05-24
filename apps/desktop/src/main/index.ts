const { app, BrowserWindow } = require('electron')
const path = require('path')

let deviceChannel: any = null
let runtimeHost: any = null
let configStore: any = null

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
    win.loadURL('http://localhost:5173')
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
