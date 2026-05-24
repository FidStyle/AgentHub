import { useState, useEffect } from 'react'

interface RuntimeInfo {
  type: string
  available: boolean
  version: string | null
  authenticated: boolean
}

export function RuntimeStatus() {
  const [runtimes, setRuntimes] = useState<RuntimeInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    detectRuntimes()
  }, [])

  const detectRuntimes = async () => {
    setLoading(true)
    const result = await window.electronAPI.runtime.detect()
    setRuntimes(result)
    setLoading(false)
  }

  const runtimeLabels: Record<string, string> = {
    claude_code: 'Claude Code',
    codex: 'Codex',
  }

  return (
    <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontWeight: 500 }}>本地 Runtime 检测</span>
        <button
          onClick={detectRuntimes}
          disabled={loading}
          style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.25rem',
            cursor: 'pointer',
            backgroundColor: 'white',
          }}
        >
          {loading ? '检测中...' : '重新检测'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {runtimes.map((rt) => (
          <div key={rt.type} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: rt.available ? '#22c55e' : '#ef4444',
            }} />
            <span style={{ fontWeight: 500 }}>{runtimeLabels[rt.type] || rt.type}</span>
            {rt.available ? (
              <>
                <span style={{ color: '#6b7280' }}>v{rt.version}</span>
                <span style={{ color: rt.authenticated ? '#22c55e' : '#f59e0b', fontSize: '0.75rem' }}>
                  {rt.authenticated ? '已认证' : '未认证'}
                </span>
              </>
            ) : (
              <span style={{ color: '#ef4444' }}>未安装</span>
            )}
          </div>
        ))}
        {runtimes.length === 0 && !loading && (
          <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>未检测到可用 Runtime</span>
        )}
      </div>
    </div>
  )
}
