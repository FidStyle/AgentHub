'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CreateWorkspaceDialog } from '@/components/workspace/CreateWorkspaceDialog'

interface WorkspaceRow {
  id: string
  name: string
  description: string
  execution_domain: 'cloud' | 'local_desktop'
  created_at: string
}

export default function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const router = useRouter()

  const fetchWorkspaces = useCallback(async () => {
    setError(null)
    const res = await fetch('/api/workspaces')
    if (res.ok) {
      setWorkspaces(await res.json())
    } else {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error || '加载失败')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchWorkspaces() }, [fetchWorkspaces])

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">我的工作区</h1>
          <button
            onClick={() => setDialogOpen(true)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 text-sm"
          >
            新建工作区
          </button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">加载中...</p>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : workspaces.length === 0 ? (
          <p className="text-muted-foreground">暂无工作区，点击右上角新建</p>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => router.push(`/workspace/${ws.id}`)}
                className="text-left p-4 bg-card rounded-lg border border-border hover:border-primary/50 hover:shadow-sm transition"
              >
                <h3 className="font-medium text-foreground">{ws.name}</h3>
                {ws.description && <p className="text-sm text-muted-foreground mt-1">{ws.description}</p>}
                <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  {ws.execution_domain === 'cloud' ? '云端执行' : '本地桌面'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <CreateWorkspaceDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={fetchWorkspaces} />
    </div>
  )
}
