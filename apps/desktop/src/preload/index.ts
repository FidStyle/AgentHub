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
      ipcRenderer.on('device-channel:state-changed', (_e, state: string) => callback(state))
    },
  },
})
