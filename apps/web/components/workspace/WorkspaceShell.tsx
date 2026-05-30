'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { ChatPanel } from './ChatPanel'
import { ArtifactPanel } from './ArtifactPanel'
import { IconButton } from '@agenthub/ui'
import { PanelLeft } from 'lucide-react'

export function WorkspaceShell({ workspaceId }: { workspaceId?: string }) {
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [leftPanelOpen, setLeftPanelOpen] = useState(false)

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
