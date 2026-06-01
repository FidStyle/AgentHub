'use client'

import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sidebar } from './Sidebar'
import { ChatPanel } from './ChatPanel'
import { ArtifactPanel } from './ArtifactPanel'
import { Badge, IconButton } from '@agenthub/ui'
import { ArrowLeft, PanelLeft, RefreshCw } from 'lucide-react'
import { useWorkspaceRuntimeStatus } from './useWorkspaceRuntimeStatus'

type WorkspaceMode = 'read-only' | 'operate'

export function WorkspaceShell({
  workspaceId,
  requestedMode = 'read-only',
}: {
  workspaceId?: string
  requestedMode?: WorkspaceMode
}) {
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [rightPanelWidth, setRightPanelWidth] = useState(360)
  const [resizingRightPanel, setResizingRightPanel] = useState(false)
  const [leftPanelOpen, setLeftPanelOpen] = useState(false)
  const [executionDomain, setExecutionDomain] = useState<'cloud' | 'local_desktop' | null>(null)
  const runtimeStatus = useWorkspaceRuntimeStatus()
  const userLabel = runtimeStatus.status?.user.name ?? runtimeStatus.status?.user.email ?? '未登录'
  const desktopConnected = runtimeStatus.status?.desktop.connected ?? false
  const localWorkspace = executionDomain === 'local_desktop'
  const readOnly = localWorkspace && (requestedMode === 'read-only' || runtimeStatus.status?.operable !== true)
  const blockReason = runtimeStatus.status?.blockReasonText ?? runtimeStatus.error ?? '正在检查本地连接状态'

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
    if (Number.isFinite(saved) && saved >= 300 && saved <= 560) setRightPanelWidth(saved)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('agenthub:right-panel-width', String(rightPanelWidth))
  }, [rightPanelWidth])

  useEffect(() => {
    if (!resizingRightPanel) return
    const onMove = (event: PointerEvent) => {
      const width = Math.min(560, Math.max(300, window.innerWidth - event.clientX))
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
  }, [resizingRightPanel])

  return (
    <div
      data-testid="workspace-shell"
      className={`relative grid h-screen min-h-0 grid-cols-1 overflow-hidden ${
        rightPanelOpen
          ? 'lg:grid-cols-[280px_minmax(480px,1fr)_var(--artifact-width)]'
          : 'lg:grid-cols-[280px_minmax(480px,1fr)]'
      }`}
      style={{ '--artifact-width': `${rightPanelWidth}px` } as CSSProperties}
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
          >
            本地 Runtime：{runtimeStatus.status?.operable ? '可操作' : '只读'}
          </Badge>
          {localWorkspace && (
            <Badge variant={readOnly ? 'warning' : 'success'} data-testid="workspace-operability-status">
              {readOnly ? '只读模式' : '可操作模式'}
            </Badge>
          )}
          {runtimeStatus.error && <span className="text-destructive">{runtimeStatus.error}</span>}
          <IconButton
            icon={RefreshCw}
            label="刷新本地连接状态"
            variant="ghost"
            size="sm"
            data-testid="refresh-runtime-status"
            onClick={() => runtimeStatus.refresh()}
          />
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
          <div
            data-testid="artifact-overlay"
            className="fixed inset-y-0 right-0 z-30 w-[320px] max-w-[85vw] border-l border-border bg-card lg:static lg:z-auto lg:h-full lg:min-h-0 lg:w-auto lg:max-w-none lg:overflow-hidden"
          >
            <button
              type="button"
              data-testid="artifact-resize-handle"
              aria-label="拖动调整右侧面板宽度"
              className="absolute left-0 top-0 hidden h-full w-1 cursor-col-resize bg-transparent hover:bg-primary/40 lg:block"
              onPointerDown={(event) => {
                event.preventDefault()
                setResizingRightPanel(true)
              }}
              onDoubleClick={() => {
                setRightPanelWidth(360)
                window.localStorage.setItem('agenthub:right-panel-width', '360')
              }}
            />
            <ArtifactPanel onClose={() => setRightPanelOpen(false)} />
          </div>
        </>
      )}
    </div>
  )
}
