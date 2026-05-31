'use client'

import { useState } from 'react'
import { useWorkspaceRuntimeStatus } from './useWorkspaceRuntimeStatus'

type ExecutionDomain = 'cloud' | 'local_desktop'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export function CreateWorkspaceDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [domain, setDomain] = useState<ExecutionDomain>('cloud')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runtimeStatus = useWorkspaceRuntimeStatus()

  if (!open) return null

  const localDesktopUnavailable = domain === 'local_desktop' && !runtimeStatus.status?.desktop.connected

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, execution_domain: domain, description }),
    })
    setLoading(false)
    if (res.ok) {
      setName('')
      setDescription('')
      setDomain('cloud')
      onCreated()
      onClose()
    } else {
      const data = await res.json().catch(() => ({}))
      setError((data as { error?: string }).error || '创建失败')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-card rounded-lg p-6 w-96 space-y-4">
        <h2 className="text-lg font-semibold">新建工作区</h2>
        <div>
          <label className="block text-sm mb-1">名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="输入工作区名称"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">描述</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="可选描述"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">执行域</label>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value as ExecutionDomain)}
            className="w-full border rounded px-3 py-2 text-sm"
          >
            <option value="cloud">云端执行</option>
            <option value="local_desktop">本地桌面</option>
          </select>
          <div data-testid="local-desktop-gate" className="mt-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {runtimeStatus.loading ? (
              '正在检查本地 Desktop 连接...'
            ) : runtimeStatus.status?.desktop.connected ? (
              `本地 Desktop 已连接：${runtimeStatus.status.desktop.device?.name ?? '当前设备'}`
            ) : (
              '本地 Desktop 未连接。可以先创建为只读工作区，连接 Desktop 后再继续执行。'
            )}
          </div>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded border border-input hover:bg-muted">
            取消
          </button>
          <button
            type="submit"
            disabled={loading || !name}
            title={localDesktopUnavailable ? '将创建为只读可查看，连接 Desktop 后才能执行' : undefined}
            className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '创建中...' : '创建'}
          </button>
        </div>
      </form>
    </div>
  )
}
