import { useState, useEffect } from 'react'

export function ConnectionStatus() {
  const [state, setState] = useState<string>('disconnected')

  useEffect(() => {
    const deviceChannel = window.electronAPI?.deviceChannel
    if (!deviceChannel) return

    deviceChannel.getState().then(setState)
    deviceChannel.onStateChanged(setState)
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
