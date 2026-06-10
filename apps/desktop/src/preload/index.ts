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
    workspaceRoots: () => ipcRenderer.invoke('runtime:workspace-roots'),
    addWorkspaceRoot: (root: string) => ipcRenderer.invoke('runtime:add-workspace-root', root),
    chooseWorkspaceRoot: () => ipcRenderer.invoke('runtime:choose-workspace-root'),
    execute: (request: { runtimeType: 'claude_code' | 'codex'; prompt: string; nativeSessionId?: string | null; continueLast?: boolean }, cwd: string) =>
      ipcRenderer.invoke('runtime:execute', request, cwd),
    cancel: () => ipcRenderer.invoke('runtime:cancel'),
    available: () => ipcRenderer.invoke('runtime:available'),
    onHostEvent: (callback: (event: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, event: unknown) => callback(event)
      ipcRenderer.on('runtime-host:event', handler)
      return () => { ipcRenderer.removeListener('runtime-host:event', handler) }
    },
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
