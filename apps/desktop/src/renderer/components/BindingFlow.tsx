import { useState } from 'react'

interface BindingFlowProps {
  onBound: (deviceToken: string) => void
}

export function BindingFlow({ onBound }: BindingFlowProps) {
  const [bindCode, setBindCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  const handleBind = async () => {
    if (bindCode.length !== 6) {
      setError('请输入 6 位绑定码')
      return
    }
    setStatus('loading')
    setError('')

    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bind_code: bindCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '绑定失败')
        setStatus('error')
        return
      }
      setStatus('success')
      onBound(data.device_token)
    } catch {
      setError('网络错误，请重试')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div style={{ padding: '1rem', border: '1px solid #22c55e', borderRadius: '0.5rem', backgroundColor: '#f0fdf4' }}>
        <span style={{ color: '#22c55e', fontWeight: 500 }}>✓ 设备绑定成功</span>
      </div>
    )
  }

  return (
    <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
      <p style={{ fontWeight: 500, marginBottom: '0.75rem' }}>设备绑定</p>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>
        请在 Web 端生成绑定码，然后在此输入
      </p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          maxLength={6}
          placeholder="输入 6 位绑定码"
          value={bindCode}
          onChange={(e) => setBindCode(e.target.value.replace(/\D/g, ''))}
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            fontSize: '1.125rem',
            letterSpacing: '0.25em',
            textAlign: 'center',
          }}
        />
        <button
          onClick={handleBind}
          disabled={status === 'loading'}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            opacity: status === 'loading' ? 0.6 : 1,
          }}
        >
          {status === 'loading' ? '绑定中...' : '绑定'}
        </button>
      </div>
      {error && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.5rem' }}>{error}</p>}
    </div>
  )
}
