'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent, Badge, StateCard } from '@agenthub/ui'

interface WorkspaceRow {
  id: string
  name: string
  execution_domain: string
}

interface SessionRow {
  id: string
  name: string
  workspace_id: string
}

export default function MobileHomePage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [selectedWs, setSelectedWs] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/workspaces')
      .then(r => {
        if (!r.ok) throw new Error('加载工作区失败')
        return r.json()
      })
      .then(d => { if (Array.isArray(d)) setWorkspaces(d) })
      .catch((e) => setError(e instanceof Error ? e.message : '加载工作区失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedWs) return
    setSessionsLoading(true)
    fetch(`/api/sessions?workspace_id=${selectedWs}`)
      .then(r => {
        if (!r.ok) throw new Error('加载聊天失败')
        return r.json()
      })
      .then(d => { if (Array.isArray(d)) setSessions(d) })
      .catch((e) => setError(e instanceof Error ? e.message : '加载聊天失败'))
      .finally(() => setSessionsLoading(false))
  }, [selectedWs])

  const createSession = async () => {
    if (!selectedWs) return
    setSessionsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: selectedWs }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || '创建聊天失败')
      router.push(`/m/sessions/${(body as SessionRow).id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建聊天失败')
      setSessionsLoading(false)
    }
  }

  if (loading) {
    return <StateCard variant="loading" />
  }

  if (error && workspaces.length === 0) {
    return <StateCard variant="error" title="加载失败" description={error} />
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-medium">工作区</h2>
      <div className="flex flex-col gap-2">
        {workspaces.map(ws => (
          <button
            key={ws.id}
            onClick={() => setSelectedWs(ws.id)}
            className={`w-full text-left rounded-lg border p-3 transition-colors ${
              selectedWs === ws.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted'
            }`}
          >
            <span className="text-sm font-medium">{ws.name}</span>
            <Badge variant="secondary" className="ml-2">
              {ws.execution_domain === 'cloud' ? '云端' : '本地'}
            </Badge>
            {ws.execution_domain === 'local_desktop' && (
              <p className="text-xs text-muted-foreground mt-1">需要 Desktop Connector 在线</p>
            )}
          </button>
        ))}
        {workspaces.length === 0 && (
          <StateCard variant="empty" title="暂无工作区" description="请先在 Web 端创建工作区" />
        )}
      </div>

      {selectedWs && (
        <>
          <div className="mt-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-medium">聊天</h2>
            <Button size="sm" onClick={createSession} disabled={sessionsLoading}>
              新建聊天
            </Button>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex flex-col gap-2">
            {sessionsLoading && sessions.length === 0 && <StateCard variant="loading" title="正在加载聊天" />}
            {sessions.map(s => (
              <Card key={s.id} className="cursor-pointer hover:bg-muted transition-colors"
                onClick={() => router.push(`/m/sessions/${s.id}`)}>
                <CardContent className="p-3">
                  <p className="text-sm truncate">{s.name}</p>
                </CardContent>
              </Card>
            ))}
            {sessions.length === 0 && (
              <StateCard variant="empty" title="暂无聊天" description="选择工作区后聊天将在此显示" />
            )}
          </div>
        </>
      )}
    </div>
  )
}
