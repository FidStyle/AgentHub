'use client'

import { useEffect, useState } from 'react'
import { IconButton, Badge } from '@agenthub/ui'
import { Plus, ChevronDown } from 'lucide-react'
import { SessionList } from './SessionList'
import { useSessionStore } from '@/store/session-store'

interface Workspace {
  id: string
  name: string
  execution_domain: string
}

export function Sidebar({ workspaceId }: { workspaceId?: string }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [wsOpen, setWsOpen] = useState(false)
  const { activeWorkspaceId, setActiveWorkspace, fetchSessions, createSession } = useSessionStore()

  useEffect(() => {
    fetch('/api/workspaces').then(r => r.json()).then(d => {
      if (Array.isArray(d)) {
        setWorkspaces(d)
        const fromUrl = workspaceId && d.some((w: Workspace) => w.id === workspaceId) ? workspaceId : null
        // URL 指定的 workspace 优先且权威（含 deep-link 间切换）；否则仅在无选中时回退第一个
        const target = fromUrl ?? (activeWorkspaceId ? null : (d.length > 0 ? d[0].id : null))
        if (target && target !== activeWorkspaceId) {
          setActiveWorkspace(target)
          fetchSessions(target)
        }
      }
    })
  }, [workspaceId])

  const activeWs = workspaces.find(w => w.id === activeWorkspaceId)

  const switchWorkspace = (id: string) => {
    setActiveWorkspace(id)
    fetchSessions(id)
    setWsOpen(false)
  }

  return (
    <aside className="flex flex-col h-full border-r border-border bg-card">
      <div className="relative px-3 py-3 border-b border-border">
        <button
          data-testid="workspace-switcher"
          onClick={() => setWsOpen(!wsOpen)}
          className="flex items-center justify-between w-full rounded-md px-2 py-1.5 text-sm hover:bg-muted"
        >
          <span className="font-medium truncate">{activeWs?.name ?? '选择工作区'}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
        {wsOpen && (
          <div data-testid="workspace-dropdown" className="absolute left-2 right-2 top-full mt-1 z-10 rounded-md border border-border bg-card shadow-md">
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => switchWorkspace(ws.id)}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted ${ws.id === activeWorkspaceId ? 'bg-muted font-medium' : ''}`}
              >
                <span className="truncate">{ws.name}</span>
                <Badge variant="secondary" className="text-[10px] ml-auto shrink-0">
                  {ws.execution_domain === 'cloud' ? '云端' : '本地'}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>
      <div data-testid="session-header" className="flex items-center justify-between px-4 py-2 border-b border-border">
        <h2 data-testid="session-header-title" className="text-xs font-semibold text-muted-foreground">会话</h2>
        <IconButton
          icon={Plus}
          label="新建会话"
          size="sm"
          data-testid="new-session-btn"
          disabled={!activeWorkspaceId}
          onClick={() => activeWorkspaceId && createSession(activeWorkspaceId)}
        />
      </div>
      <div className="flex-1 overflow-hidden p-2">
        <SessionList />
      </div>
    </aside>
  )
}
