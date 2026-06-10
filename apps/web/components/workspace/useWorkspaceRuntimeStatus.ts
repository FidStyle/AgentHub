'use client'

import { useCallback, useEffect, useState } from 'react'

export type WorkspaceRuntimeStatus = {
  readOnlyAvailable: boolean
  operable: boolean
  blockReason:
    | 'desktop_not_bound'
    | 'desktop_offline'
    | 'runtime_status_unknown'
    | 'runtime_missing'
    | 'runtime_auth_required'
    | 'native_session_unavailable'
    | null
  blockReasonText: string | null
  user: {
    id: string
    name: string | null
    email: string | null
  }
  desktop: {
    status: 'connected' | 'disconnected' | 'not_bound'
    connected: boolean
    device: { id: string; name: string; last_heartbeat: string | null } | null
    workspaceRoots: Array<{ path: string; healthy: boolean }>
  }
  runtime: {
    status: 'ready' | 'unavailable'
    doctorKnown: boolean
    nativeSessionAvailable: boolean
    nativeSessionDescription: string
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
