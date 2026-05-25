'use client'

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { ChatPanel } from './ChatPanel'
import { ArtifactPanel } from './ArtifactPanel'

export function WorkspaceShell() {
  const [rightPanelOpen, setRightPanelOpen] = useState(true)

  return (
    <div
      data-testid="workspace-shell"
      className={`grid h-screen ${rightPanelOpen ? 'grid-cols-[280px_1fr_320px]' : 'grid-cols-[280px_1fr]'}`}
    >
      <Sidebar />
      <ChatPanel onTogglePanel={() => setRightPanelOpen(!rightPanelOpen)} />
      {rightPanelOpen && <ArtifactPanel onClose={() => setRightPanelOpen(false)} />}
    </div>
  )
}
