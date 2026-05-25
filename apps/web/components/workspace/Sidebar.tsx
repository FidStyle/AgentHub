'use client'

import { Button } from '@agenthub/ui'
import { SessionList } from './SessionList'

export function Sidebar() {
  return (
    <aside className="flex flex-col h-full border-r border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-sm font-semibold">会话</h2>
        <Button variant="ghost" size="sm">
          新建
        </Button>
      </div>
      <div className="flex-1 overflow-hidden p-2">
        <SessionList />
      </div>
    </aside>
  )
}
