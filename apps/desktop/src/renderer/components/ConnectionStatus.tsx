import { useState, useEffect } from 'react'

declare global {
  interface Window {
    electronAPI: {
      platform: string
      versions: { node: string; chrome: string; electron: string }
      runtime: {
        detect: () => Promise<Array<{ type: string; available: boolean; version: string | null; authenticated: boolean }>>
        cached: () => Promise<Array<{ type: string; available: boolean; version: string | null; authenticated: boolean }>>
      }
      runtimeConfig: {
        get: () => Promise<Record<string, { enabled: boolean; authMode: string; env: Record<string, string>; nativeConfig: Record<string, unknown> }>>
        save: (type: string, config: { enabled: boolean; authMode: string; env: Record<string, string>; nativeConfig: Record<string, unknown> }) => Promise<boolean>
        test: (type: string) => Promise<{ ok: boolean; version?: string; error?: string }>
      }
      deviceChannel: {
        connect: (config: { gatewayUrl: string; deviceToken: string }) => Promise<void>
        disconnect: () => Promise<void>
        getState: () => Promise<string>
        onStateChanged: (callback: (state: string) => void) => void
      }
    }
  }
}

export function ConnectionStatus() {
  const [state, setState] = useState<string>('disconnected')

  useEffect(() => {
    window.electronAPI.deviceChannel.getState().then(setState)
    window.electronAPI.deviceChannel.onStateChanged(setState)
  }, [])

  const stateLabels: Record<string, { text: string; color: string }> = {
    disconnected: { text: '未连接', color: '#ef4444' },
    connecting: { text: '连接中...', color: '#f59e0b' },
    authenticating: { text: '鉴权中...', color: '#f59e0b' },
    connected: { text: '已连接', color: '#22c55e' },
    reconnecting: { text: '重连中...', color: '#f59e0b' },
  }

  const { text, color } = stateLabels[state] || stateLabels.disconnected

  return (
    <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color }} />
        <span style={{ fontWeight: 500 }}>连接状态：</span>
        <span style={{ color }}>{text}</span>
      </div>
    </div>
  )
}
