'use client'

import { useState } from 'react'
import { Button, Card, StateCard } from '@agenthub/ui'

const TABS = ['产物', '上下文', 'Agents'] as const

export function ArtifactPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('产物')

  return (
    <aside data-testid="artifact-panel" className="flex flex-col h-full bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          关闭
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <StateCard variant="empty" />
      </div>
    </aside>
  )
}
