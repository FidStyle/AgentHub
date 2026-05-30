'use client'

import { useState } from 'react'
import { Button, StateCard } from '@agenthub/ui'
import { OrchestratorPanel } from '../orchestrator/OrchestratorPanel'

const TABS = ['产物', '编排', '上下文', 'Agents'] as const

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
        <Button variant="ghost" size="sm" data-testid="artifact-close-btn" onClick={onClose}>
          关闭
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === '产物' && (
          <StateCard variant="empty" title="暂无产物" description="Agent 执行任务后，代码、文件和结果将在此展示" />
        )}
        {activeTab === '编排' && <OrchestratorPanel />}
        {activeTab === '上下文' && (
          <StateCard variant="empty" title="暂无上下文" description="会话中引用的文件和资源将在此展示" />
        )}
        {activeTab === 'Agents' && (
          <StateCard variant="empty" title="暂无 Agent" description="参与当前会话的 Role Agent 将在此展示" />
        )}
      </div>
    </aside>
  )
}
