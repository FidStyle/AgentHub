'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, Badge, StateCard } from '@agenthub/ui'

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
  const router = useRouter()

  useEffect(() => {
    fetch('/api/workspaces')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setWorkspaces(d) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedWs) return
    fetch(`/api/sessions?workspace_id=${selectedWs}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSessions(d) })
  }, [selectedWs])

  if (loading) {
    return <StateCard variant="loading" />
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
          <h2 className="text-sm font-medium mt-2">会话</h2>
          <div className="flex flex-col gap-2">
            {sessions.map(s => (
              <Card key={s.id} className="cursor-pointer hover:bg-muted transition-colors"
                onClick={() => router.push(`/m/sessions/${s.id}`)}>
                <CardContent className="p-3">
                  <p className="text-sm truncate">{s.name}</p>
                </CardContent>
              </Card>
            ))}
            {sessions.length === 0 && (
              <StateCard variant="empty" title="暂无会话" description="选择工作区后会话将在此显示" />
            )}
          </div>
        </>
      )}
    </div>
  )
}
