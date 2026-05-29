export interface RuntimeInfo {
  type: string
  available: boolean
  version: string | null
  authenticated: boolean
}

interface ElectronRuntimeApi {
  detect: () => Promise<RuntimeInfo[]>
}

interface ElectronApi {
  platform?: string
  versions?: { node: string; chrome: string; electron: string }
  runtime?: ElectronRuntimeApi
  runtimeConfig?: {
    get: () => Promise<Record<string, { enabled: boolean; authMode: string; env: Record<string, string>; nativeConfig: Record<string, unknown> }>>
    save: (type: string, config: { enabled: boolean; authMode: string; env: Record<string, string>; nativeConfig: Record<string, unknown> }) => Promise<boolean>
    test: (type: string) => Promise<{ ok: boolean; version?: string; error?: string }>
  }
  deviceChannel?: {
    connect: (config: { gatewayUrl: string; deviceToken: string }) => Promise<void>
    disconnect: () => Promise<void>
    getState: () => Promise<string>
    onStateChanged: (callback: (state: string) => void) => (() => void) | void
  }
  auth?: {
    onDeviceBind: (callback: (data: { code: string }) => void) => (() => void) | undefined
  }
}

declare global {
  interface Window {
    electronAPI?: ElectronApi
  }
}

export function getElectronAPI(): ElectronApi | null {
  return window.electronAPI ?? null
}

export function getRuntimeApi(): ElectronRuntimeApi | null {
  const runtime = window.electronAPI?.runtime
  if (!runtime || typeof runtime.detect !== 'function') return null
  return runtime
}
