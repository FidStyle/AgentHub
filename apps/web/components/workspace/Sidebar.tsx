'use client'

import { IconButton } from '@agenthub/ui'
import { Plus } from 'lucide-react'
import { SessionList } from './SessionList'

export function Sidebar() {
  return (
    <aside className="flex flex-col h-full border-r border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-sm font-semibold">会话</h2>
        <IconButton icon={Plus} label="新建会话" size="sm" />
      </div>
      <div className="flex-1 overflow-hidden p-2">
        <SessionList />
      </div>
    </aside>
  )
}
