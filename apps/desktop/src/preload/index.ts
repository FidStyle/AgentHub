import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  runtime: {
    detect: () => ipcRenderer.invoke('runtime:detect'),
    cached: () => ipcRenderer.invoke('runtime:cached'),
    execute: (command: string, cwd: string) => ipcRenderer.invoke('runtime:execute', command, cwd),
    available: () => ipcRenderer.invoke('runtime:available'),
  },
  runtimeConfig: {
    get: () => ipcRenderer.invoke('runtime-config:get'),
    save: (type: string, config: unknown) => ipcRenderer.invoke('runtime-config:save', type, config),
    test: (type: string) => ipcRenderer.invoke('runtime-config:test', type),
  },
  deviceChannel: {
    connect: (config: { gatewayUrl: string; deviceToken: string }) =>
      ipcRenderer.invoke('device-channel:connect', config),
    disconnect: () => ipcRenderer.invoke('device-channel:disconnect'),
    getState: () => ipcRenderer.invoke('device-channel:state'),
    onStateChanged: (callback: (state: string) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, state: string) => callback(state)
      ipcRenderer.on('device-channel:state-changed', handler)
      return () => { ipcRenderer.removeListener('device-channel:state-changed', handler) }
    },
  },
  auth: {
    onDeviceBind: (callback: (data: { code: string }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: { code: string }) => callback(data)
      ipcRenderer.on('device-bind', handler)
      return () => { ipcRenderer.removeListener('device-bind', handler) }
    },
  },
})
