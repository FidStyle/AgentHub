'use client'

import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sidebar } from './Sidebar'
import { ChatPanel } from './ChatPanel'
import { ArtifactPanel } from './ArtifactPanel'
import { Badge, IconButton } from '@agenthub/ui'
import { ArrowLeft, GripVertical, PanelLeft, RefreshCw } from 'lucide-react'
import { useWorkspaceRuntimeStatus } from './useWorkspaceRuntimeStatus'
import { NotificationBell } from '../orchestrator/NotificationBell'
import { useSessionStore } from '@/store/session-store'

type WorkspaceMode = 'read-only' | 'operate'
const RIGHT_PANEL_DEFAULT_WIDTH = 420
const RIGHT_PANEL_MIN_WIDTH = 320
const RIGHT_PANEL_NORMAL_MAX_WIDTH = 760
const RIGHT_PANEL_WIDE_MAX_WIDTH = 1040
const RIGHT_PANEL_RESIZER_WIDTH = 12

function clampRightPanelWidth(width: number, wideMode: boolean) {
  if (typeof window === 'undefined') return width
  const available = Math.max(RIGHT_PANEL_MIN_WIDTH, window.innerWidth - 600)
  const max = Math.min(wideMode ? RIGHT_PANEL_WIDE_MAX_WIDTH : RIGHT_PANEL_NORMAL_MAX_WIDTH, available)
  return Math.min(max, Math.max(RIGHT_PANEL_MIN_WIDTH, width))
}

export function WorkspaceShell({
  workspaceId,
  requestedMode = 'read-only',
}: {
  workspaceId?: string
  requestedMode?: WorkspaceMode
}) {
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [rightPanelWidth, setRightPanelWidth] = useState(RIGHT_PANEL_DEFAULT_WIDTH)
  const [rightPanelWide, setRightPanelWide] = useState(false)
  const [resizingRightPanel, setResizingRightPanel] = useState(false)
  const [leftPanelOpen, setLeftPanelOpen] = useState(false)
  const [executionDomain, setExecutionDomain] = useState<'cloud' | 'local_desktop' | null>(null)
  const { activeWorkspaceId, setActiveWorkspace, fetchSessions } = useSessionStore()
  const runtimeStatus = useWorkspaceRuntimeStatus()
  const userLabel = runtimeStatus.status?.user.name ?? runtimeStatus.status?.user.email ?? '未登录'
  const desktopConnected = runtimeStatus.status?.desktop.connected ?? false
  const localWorkspace = executionDomain === 'local_desktop'
  const readOnly = localWorkspace && (requestedMode === 'read-only' || runtimeStatus.status?.operable !== true)
  const blockReason = runtimeStatus.status?.blockReasonText ?? runtimeStatus.error ?? '正在检查本地连接状态'
  const runtimeReadyLabel = localWorkspace && runtimeStatus.status?.operable
    ? '一次性可执行'
    : runtimeStatus.status?.operable ? '可操作' : '只读'

  useEffect(() => {
    if (!workspaceId || activeWorkspaceId === workspaceId) return
    setActiveWorkspace(workspaceId)
    fetchSessions(workspaceId)
  }, [activeWorkspaceId, fetchSessions, setActiveWorkspace, workspaceId])

  useEffect(() => {
    if (!workspaceId) {
      setExecutionDomain(null)
      return
    }
    fetch(`/api/workspaces/${workspaceId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((workspace: { execution_domain?: 'cloud' | 'local_desktop' } | null) => {
        setExecutionDomain(workspace?.execution_domain ?? null)
      })
      .catch(() => setExecutionDomain(null))
  }, [workspaceId])

  useEffect(() => {
    const saved = Number(window.localStorage.getItem('agenthub:right-panel-width') ?? '')
    const savedWide = window.localStorage.getItem('agenthub:right-panel-wide') === 'true'
    setRightPanelWide(savedWide)
    if (Number.isFinite(saved)) setRightPanelWidth(clampRightPanelWidth(saved, savedWide))
  }, [])

  useEffect(() => {
    const width = clampRightPanelWidth(rightPanelWidth, rightPanelWide)
    if (width !== rightPanelWidth) {
      setRightPanelWidth(width)
      return
    }
    window.localStorage.setItem('agenthub:right-panel-width', String(width))
    window.localStorage.setItem('agenthub:right-panel-wide', String(rightPanelWide))
  }, [rightPanelWidth, rightPanelWide])

  useEffect(() => {
    if (!resizingRightPanel) return
    const onMove = (event: PointerEvent) => {
      const width = clampRightPanelWidth(window.innerWidth - event.clientX, rightPanelWide)
      setRightPanelWidth(width)
    }
    const onUp = () => {
      setResizingRightPanel(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [resizingRightPanel, rightPanelWide])

  function requestWidePanel(nextWide = true) {
    setRightPanelOpen(true)
    setRightPanelWide(nextWide)
    setRightPanelWidth((current) => {
      const target = nextWide ? Math.max(current, 760) : Math.min(current, RIGHT_PANEL_DEFAULT_WIDTH)
      return clampRightPanelWidth(target, nextWide)
    })
  }

  return (
    <div
      data-testid="workspace-shell"
      className={`relative grid h-screen min-h-0 grid-cols-1 overflow-hidden ${
        rightPanelOpen
          ? 'lg:grid-cols-[280px_minmax(320px,1fr)_var(--artifact-resizer-width)_var(--artifact-width)]'
          : 'lg:grid-cols-[280px_minmax(320px,1fr)]'
      }`}
      style={{
        '--artifact-width': `${rightPanelWidth}px`,
        '--artifact-resizer-width': `${RIGHT_PANEL_RESIZER_WIDTH}px`,
      } as CSSProperties}
    >
      {/* 桌面：左栏常驻；移动：抽屉 overlay，由顶部入口触发 */}
      <div
        data-testid="sidebar-region"
        className={`min-h-0 ${
          leftPanelOpen
            ? 'fixed inset-y-0 left-0 z-30 w-[280px]'
            : 'hidden'
        } lg:static lg:z-auto lg:block lg:w-auto`}
      >
        <Sidebar workspaceId={workspaceId} />
      </div>
      {leftPanelOpen && (
        <div
          data-testid="sidebar-backdrop"
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setLeftPanelOpen(false)}
        />
      )}

      <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
        {/* 移动顶栏（app bar）置于 backdrop(z-20) 之上保证导航入口可点，但低于抽屉(z-30) 使打开的抽屉覆盖顶栏；lg: 隐藏不影响桌面 */}
        <div className="relative z-[25] flex items-center gap-2 border-b border-border p-2 lg:hidden">
          <IconButton
            icon={PanelLeft}
            label="打开工作区导航"
            variant="ghost"
            size="sm"
            data-testid="open-sidebar"
            onClick={() => {
              setRightPanelOpen(false)
              setLeftPanelOpen(true)
            }}
          />
          <Link href="/workspace" className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            我的工作区
          </Link>
        </div>
        <div
          data-testid="workspace-status-bar"
          className="shrink-0 flex min-h-11 flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-2 text-xs"
        >
          <Link
            href="/workspace"
            className="hidden items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground lg:inline-flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            我的工作区
          </Link>
          <Badge variant="secondary" data-testid="workspace-user-status">
            登录：{userLabel}
          </Badge>
          <Badge
            variant={desktopConnected ? 'success' : 'secondary'}
            data-testid="workspace-desktop-status"
          >
            Desktop：{desktopConnected ? '已连接' : '未连接'}
          </Badge>
          <Badge
            variant={runtimeStatus.status?.operable ? 'success' : 'secondary'}
            data-testid="workspace-runtime-status"
            title={localWorkspace ? runtimeStatus.status?.runtime.nativeSessionDescription : undefined}
          >
            本地 Runtime：{runtimeReadyLabel}
          </Badge>
          {localWorkspace && (
            <Badge variant={readOnly ? 'warning' : 'success'} data-testid="workspace-operability-status">
              {readOnly ? '只读模式' : '可操作模式'}
            </Badge>
          )}
          {runtimeStatus.error && <span className="text-destructive">{runtimeStatus.error}</span>}
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <IconButton
              icon={RefreshCw}
              label="刷新本地连接状态"
              variant="ghost"
              size="sm"
              data-testid="refresh-runtime-status"
              onClick={() => runtimeStatus.refresh()}
            />
          </div>
        </div>
        {readOnly && (
          <div data-testid="workspace-readonly-banner" className="shrink-0 border-b border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            {blockReason}
          </div>
        )}
        <ChatPanel
          onTogglePanel={() => setRightPanelOpen((v) => !v)}
          readOnly={readOnly}
          readOnlyReason={readOnly ? blockReason : null}
          onRefreshRuntimeStatus={runtimeStatus.refresh}
        />
      </div>

      {/* 桌面：第三栏；移动：fixed overlay 抽屉，不挤压主聊天区 */}
      {rightPanelOpen && (
        <>
          {/* 移动态 backdrop：点击外部关闭，与 sidebar drawer 行为对齐（FIX-O1 / REG-20260531-003）；
              z-20 低于抽屉 z-30，桌面 lg: 隐藏不影响三栏布局 */}
          <div
            data-testid="artifact-backdrop"
            className="fixed inset-0 z-20 bg-black/40 lg:hidden"
            onClick={() => setRightPanelOpen(false)}
          />
          <button
            type="button"
            data-testid="artifact-resize-handle"
            aria-label="拖动中间分界线调整右侧面板宽度"
            title="拖动调整右侧工作台宽度"
            className={`group relative hidden h-full cursor-col-resize touch-none border-x border-border/80 bg-muted/40 text-muted-foreground outline-none transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring lg:flex lg:items-center lg:justify-center ${
              resizingRightPanel ? 'border-primary/70 bg-primary/15 text-primary' : ''
            }`}
            onPointerDown={(event) => {
              event.preventDefault()
              event.currentTarget.setPointerCapture?.(event.pointerId)
              setResizingRightPanel(true)
            }}
            onDoubleClick={() => {
              requestWidePanel(false)
              window.localStorage.setItem('agenthub:right-panel-width', String(RIGHT_PANEL_DEFAULT_WIDTH))
            }}
          >
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border group-hover:bg-primary/60" aria-hidden="true" />
            <GripVertical className="relative h-4 w-4 opacity-70" aria-hidden="true" />
          </button>
          <div
            data-testid="artifact-overlay"
            className="fixed inset-y-0 right-0 z-30 w-[320px] max-w-[85vw] border-l border-border bg-card lg:static lg:z-auto lg:h-full lg:min-h-0 lg:w-auto lg:max-w-none lg:overflow-hidden lg:border-l-0"
          >
            <ArtifactPanel
              onClose={() => setRightPanelOpen(false)}
              wideMode={rightPanelWide}
              onRequestWide={requestWidePanel}
            />
          </div>
        </>
      )}
    </div>
  )
}
