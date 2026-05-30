'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Sidebar } from './Sidebar'
import { ChatPanel } from './ChatPanel'
import { ArtifactPanel } from './ArtifactPanel'
import { Badge, IconButton } from '@agenthub/ui'
import { ArrowLeft, PanelLeft, RefreshCw } from 'lucide-react'
import { useWorkspaceRuntimeStatus } from './useWorkspaceRuntimeStatus'

export function WorkspaceShell({ workspaceId }: { workspaceId?: string }) {
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [leftPanelOpen, setLeftPanelOpen] = useState(false)
  const runtimeStatus = useWorkspaceRuntimeStatus()
  const userLabel = runtimeStatus.status?.user.name ?? runtimeStatus.status?.user.email ?? '未登录'
  const desktopConnected = runtimeStatus.status?.desktop.connected ?? false

  return (
    <div
      data-testid="workspace-shell"
      className={`relative h-screen overflow-x-hidden grid grid-cols-1 ${
        rightPanelOpen
          ? 'lg:grid-cols-[280px_minmax(480px,1fr)_320px]'
          : 'lg:grid-cols-[280px_minmax(480px,1fr)]'
      }`}
    >
      {/* 桌面：左栏常驻；移动：抽屉 overlay，由顶部入口触发 */}
      <div
        data-testid="sidebar-region"
        className={`${
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

      <div className="min-w-0 flex flex-col h-full">
        {/* 移动顶栏（app bar）置于 backdrop(z-20) 之上保证导航入口可点，但低于抽屉(z-30) 使打开的抽屉覆盖顶栏；lg: 隐藏不影响桌面 */}
        <div className="relative z-[25] flex items-center gap-2 border-b border-border p-2 lg:hidden">
          <IconButton
            icon={PanelLeft}
            label="打开工作区导航"
            variant="ghost"
            size="sm"
            data-testid="open-sidebar"
            onClick={() => setLeftPanelOpen(true)}
          />
          <Link href="/workspace" className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" />
            我的工作区
          </Link>
        </div>
        <div
          data-testid="workspace-status-bar"
          className="flex min-h-11 flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-2 text-xs"
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
            variant={runtimeStatus.status?.runtime.status === 'ready' ? 'success' : 'secondary'}
            data-testid="workspace-runtime-status"
          >
            本地 Runtime：{runtimeStatus.status?.runtime.status === 'ready' ? '可用' : '不可用'}
          </Badge>
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
        <ChatPanel onTogglePanel={() => setRightPanelOpen((v) => !v)} />
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
            className="fixed inset-y-0 right-0 z-30 w-[320px] max-w-[85vw] border-l border-border bg-card lg:static lg:z-auto lg:w-auto lg:max-w-none"
          >
            <ArtifactPanel onClose={() => setRightPanelOpen(false)} />
          </div>
        </>
      )}
    </div>
  )
}
