'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CreateWorkspaceDialog } from '@/components/workspace/CreateWorkspaceDialog'
import { useWorkspaceRuntimeStatus } from '@/components/workspace/useWorkspaceRuntimeStatus'

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
  const runtimeStatus = useWorkspaceRuntimeStatus()

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
            {workspaces.map((ws) => {
              const local = ws.execution_domain === 'local_desktop'
              const operable = !local || runtimeStatus.status?.operable === true
              const reason = local ? runtimeStatus.status?.blockReasonText ?? runtimeStatus.error ?? '正在检查本地连接状态' : null
              return (
                <article
                  key={ws.id}
                  className="text-left p-4 bg-card rounded-lg border border-border hover:border-primary/50 hover:shadow-sm transition"
                  data-testid={`workspace-card-${ws.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-medium text-foreground truncate">{ws.name}</h3>
                      {ws.description && <p className="text-sm text-muted-foreground mt-1">{ws.description}</p>}
                    </div>
                    <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {local ? '本地 Desktop' : '云端执行'}
                    </span>
                  </div>
                  <p className={`mt-3 text-xs ${operable ? 'text-success' : 'text-warning'}`}>
                    {local
                      ? operable ? '可操作：Desktop 与本地 Runtime 已就绪' : `只读：${reason}`
                      : '可操作：云端工作区'}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {local ? (
                      <>
                        <button
                          type="button"
                          className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-muted"
                          onClick={() => router.push(`/workspace/${ws.id}?mode=read-only`)}
                        >
                          查看历史
                        </button>
                        <button
                          type="button"
                          className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50"
                          disabled={!operable}
                          title={operable ? undefined : reason ?? undefined}
                          onClick={() => router.push(`/workspace/${ws.id}?mode=operate`)}
                        >
                          连接并继续
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                        onClick={() => router.push(`/workspace/${ws.id}`)}
                      >
                        进入工作区
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <CreateWorkspaceDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={fetchWorkspaces} />
    </div>
  )
}
