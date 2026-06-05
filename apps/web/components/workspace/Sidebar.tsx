'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconButton, Badge } from '@agenthub/ui'
import { Plus, ChevronDown, Trash2 } from 'lucide-react'
import { SessionList } from './SessionList'
import { useSessionStore } from '@/store/session-store'

interface Workspace {
  id: string
  name: string
  execution_domain: string
}

const MARGIN = 8
const GAP = 4

// portal 下拉定位（R1 portal-to-body / R2 flip / R3 clamp / R4 max-height+内部滚动 / R8 popover 层）。
// 下方空间不足时翻到上方；宽度对齐 trigger；高度受可用空间与 maxHeight 双重 clamp，长列表内部滚动而非撑高页面。
function computeDropdown(trigger: DOMRect): { top: number; left: number; width: number; maxHeight: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const spaceBelow = vh - trigger.bottom - GAP - MARGIN
  const spaceAbove = trigger.top - GAP - MARGIN
  const below = spaceBelow >= spaceAbove
  const avail = Math.max(0, below ? spaceBelow : spaceAbove)
  const maxHeight = Math.min(avail, Math.round(vh * 0.6))
  const top = below ? trigger.bottom + GAP : Math.max(MARGIN, trigger.top - GAP - maxHeight)
  const width = trigger.width
  const left = Math.max(MARGIN, Math.min(trigger.left, vw - width - MARGIN))
  return { top, left, width, maxHeight }
}

export function Sidebar({ workspaceId }: { workspaceId?: string }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [wsOpen, setWsOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { activeWorkspaceId, setActiveWorkspace, fetchSessions, createSession } = useSessionStore()

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/workspaces').then(r => r.json()).then(d => {
      if (cancelled) return
      if (Array.isArray(d)) {
        setWorkspaces(d)
        const fromUrl = workspaceId && d.some((w: Workspace) => w.id === workspaceId) ? workspaceId : null
        // URL 指定的 workspace 优先且权威（含 deep-link 间切换）；否则仅在无选中时回退第一个。
        const target = fromUrl ?? (activeWorkspaceId ? null : (d.length > 0 ? d[0].id : null))
        if (target && target !== activeWorkspaceId) {
          setActiveWorkspace(target)
          fetchSessions(target)
        }
      }
    })
    return () => {
      cancelled = true
    }
  }, [activeWorkspaceId, fetchSessions, setActiveWorkspace, workspaceId])

  useLayoutEffect(() => {
    if (!wsOpen || !triggerRef.current) return
    const update = () => {
      if (!triggerRef.current) return
      setPos(computeDropdown(triggerRef.current.getBoundingClientRect()))
    }
    update()
    // 点击 trigger / dropdown 之外关闭（不用全屏 backdrop，避免遮挡并拦截 trigger 点击）。
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (triggerRef.current?.contains(t as Node) || t?.closest('[data-testid="workspace-dropdown"]')) return
      setWsOpen(false)
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [wsOpen, workspaces.length])

  const activeWs = workspaces.find(w => w.id === activeWorkspaceId)

  const switchWorkspace = (id: string) => {
    setActiveWorkspace(id)
    fetchSessions(id)
    setWsOpen(false)
  }

  const deleteWorkspace = async (workspace: Workspace) => {
    if (!confirm(`确定删除工作区「${workspace.name}」吗？相关会话、消息和云端项目目录会一并删除。`)) return
    const res = await fetch(`/api/workspaces/${workspace.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      alert((body as { error?: string }).error || '删除工作区失败')
      return
    }
    const next = workspaces.filter((item) => item.id !== workspace.id)
    setWorkspaces(next)
    setWsOpen(false)
    if (workspace.id === activeWorkspaceId) {
      const target = next[0]?.id
      if (target) {
        setActiveWorkspace(target)
        fetchSessions(target)
        window.location.href = `/workspace/${target}`
      } else {
        window.location.href = '/workspace'
      }
    }
  }

  return (
    <aside className="flex flex-col h-full border-r border-border bg-card">
      <div className="px-3 py-3 border-b border-border">
        <button
          ref={triggerRef}
          data-testid="workspace-switcher"
          onClick={() => setWsOpen(!wsOpen)}
          className="flex items-center justify-between w-full rounded-md px-2 py-1.5 text-sm hover:bg-muted"
        >
          <span className="font-medium truncate">{activeWs?.name ?? '选择工作区'}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
        <WorkspaceDropdown
          open={mounted && wsOpen}
          pos={pos}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSelect={switchWorkspace}
          onDelete={deleteWorkspace}
        />
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

function WorkspaceDropdown({
  open,
  pos,
  workspaces,
  activeWorkspaceId,
  onSelect,
  onDelete,
}: {
  open: boolean
  pos: { top: number; left: number; width: number; maxHeight: number } | null
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  onSelect: (id: string) => void
  onDelete: (workspace: Workspace) => void
}) {
  if (!open) return null
  return createPortal(
    <div
      data-testid="workspace-dropdown"
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: pos?.width ?? 0,
        maxHeight: pos?.maxHeight ?? 0,
        visibility: pos ? 'visible' : 'hidden',
      }}
      className="fixed z-50 overflow-y-auto rounded-md border border-border bg-card shadow-md"
    >
      {workspaces.map(ws => (
        <div key={ws.id} className={`flex items-center gap-1 px-1 py-1 ${ws.id === activeWorkspaceId ? 'bg-muted' : ''}`}>
          <button
            onClick={() => onSelect(ws.id)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
          >
            <span className="truncate">{ws.name}</span>
            <Badge variant="secondary" className="text-[10px] ml-auto shrink-0">
              {ws.execution_domain === 'cloud' ? '云端' : '本地'}
            </Badge>
          </button>
          <button
            type="button"
            aria-label={`删除工作区 ${ws.name}`}
            data-testid={`delete-workspace-${ws.id}`}
            className="rounded-sm p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(ws)
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}
