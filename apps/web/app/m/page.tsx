'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface WorkspaceRow {
  id: string
  name: string
  execution_domain: string
}

interface SessionRow {
  id: string
  name: string
  workspace_id: string
}

export default function MobileHomePage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [selectedWs, setSelectedWs] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/workspaces').then(r => r.json()).then(d => { if (Array.isArray(d)) setWorkspaces(d) })
  }, [])

  useEffect(() => {
    if (!selectedWs) return
    fetch(`/api/sessions?workspace_id=${selectedWs}`).then(r => r.json()).then(d => { if (Array.isArray(d)) setSessions(d) })
  }, [selectedWs])

  return (
    <div>
      <h2 className="text-lg font-medium mb-3">工作区</h2>
      <div className="space-y-2 mb-6">
        {workspaces.map(ws => (
          <button
            key={ws.id}
            onClick={() => setSelectedWs(ws.id)}
            className={`w-full text-left p-3 rounded-lg border ${selectedWs === ws.id ? 'border-blue-500 bg-blue-50' : 'bg-white'}`}
          >
            <span className="font-medium">{ws.name}</span>
            <span className="ml-2 text-xs text-gray-400">{ws.execution_domain === 'cloud' ? '云端' : '本地'}</span>
          </button>
        ))}
        {workspaces.length === 0 && <p className="text-gray-400 text-sm">暂无工作区</p>}
      </div>

      {selectedWs && (
        <>
          <h2 className="text-lg font-medium mb-3">会话</h2>
          <div className="space-y-2">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => router.push(`/m/sessions/${s.id}`)}
                className="w-full text-left p-3 rounded-lg border bg-white hover:border-blue-300"
              >
                {s.name}
              </button>
            ))}
            {sessions.length === 0 && <p className="text-gray-400 text-sm">暂无会话</p>}
          </div>
        </>
      )}
    </div>
  )
}
