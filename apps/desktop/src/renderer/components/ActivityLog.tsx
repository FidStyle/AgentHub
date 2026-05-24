import { useState, useEffect, useRef } from 'react'

interface LogEntry {
  id: string
  time: string
  type: 'info' | 'request' | 'event' | 'error'
  message: string
}

export function ActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: '1', time: new Date().toLocaleTimeString('zh-CN'), type: 'info', message: '连接器已启动' },
  ])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const typeColors: Record<string, string> = {
    info: '#6b7280',
    request: '#3b82f6',
    event: '#22c55e',
    error: '#ef4444',
  }

  return (
    <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
      <span style={{ fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}>活动日志</span>
      <div style={{
        maxHeight: '150px',
        overflowY: 'auto',
        fontSize: '0.75rem',
        fontFamily: 'monospace',
        backgroundColor: '#f9fafb',
        padding: '0.5rem',
        borderRadius: '0.25rem',
      }}>
        {logs.map((log) => (
          <div key={log.id} style={{ marginBottom: '0.25rem' }}>
            <span style={{ color: '#9ca3af' }}>{log.time}</span>
            {' '}
            <span style={{ color: typeColors[log.type] }}>[{log.type}]</span>
            {' '}
            <span>{log.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
