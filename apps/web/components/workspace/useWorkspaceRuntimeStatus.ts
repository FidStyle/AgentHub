'use client'

import { useCallback, useEffect, useState } from 'react'

export type WorkspaceRuntimeStatus = {
  user: {
    id: string
    name: string | null
    email: string | null
  }
  desktop: {
    status: 'connected' | 'disconnected' | 'not_bound'
    connected: boolean
    device: { id: string; name: string; last_heartbeat: string | null } | null
  }
  runtime: {
    status: 'ready' | 'unavailable'
    description: string
  }
}

export function useWorkspaceRuntimeStatus() {
  const [status, setStatus] = useState<WorkspaceRuntimeStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/runtime/status')
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || '加载本地连接状态失败')
      setStatus(body as WorkspaceRuntimeStatus)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载本地连接状态失败')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { status, loading, error, refresh }
}
