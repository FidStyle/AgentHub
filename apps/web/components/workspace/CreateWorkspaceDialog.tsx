'use client'

import { useEffect, useMemo, useState } from 'react'
import { useWorkspaceRuntimeStatus } from './useWorkspaceRuntimeStatus'

type ExecutionDomain = 'cloud' | 'local_desktop'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (workspace: { id: string; execution_domain: ExecutionDomain }) => void
}

export function CreateWorkspaceDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [domain, setDomain] = useState<ExecutionDomain>('cloud')
  const [selectedLocalRoot, setSelectedLocalRoot] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const runtimeStatus = useWorkspaceRuntimeStatus()

  const healthyLocalRoots = useMemo(
    () => runtimeStatus.status?.desktop.workspaceRoots.filter((root) => root.healthy) ?? [],
    [runtimeStatus.status?.desktop.workspaceRoots],
  )
  const localDesktopUnavailable = domain === 'local_desktop' && (
    runtimeStatus.status?.operable !== true || !selectedLocalRoot
  )

  useEffect(() => {
    if (domain !== 'local_desktop') return
    if (selectedLocalRoot && healthyLocalRoots.some((root) => root.path === selectedLocalRoot)) return
    setSelectedLocalRoot(healthyLocalRoots[0]?.path ?? '')
  }, [domain, healthyLocalRoots, selectedLocalRoot])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        execution_domain: domain,
        description,
        ...(domain === 'local_desktop' ? { local_root_display: selectedLocalRoot } : {}),
      }),
    })
    setLoading(false)
    if (res.ok) {
      const workspace = await res.json()
      setName('')
      setDescription('')
      setDomain('cloud')
      setSelectedLocalRoot('')
      onCreated(workspace as { id: string; execution_domain: ExecutionDomain })
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
              '本地 Desktop 未连接，当前不能创建可执行的本地工作区。'
            )}
          </div>
          {domain === 'local_desktop' && (
            <div className="mt-3 space-y-2">
              <label className="block text-sm mb-1">本地工作目录</label>
              <select
                value={selectedLocalRoot}
                onChange={(e) => setSelectedLocalRoot(e.target.value)}
                disabled={healthyLocalRoots.length === 0}
                className="w-full border rounded px-3 py-2 text-sm disabled:opacity-50"
                data-testid="local-root-select"
              >
                {healthyLocalRoots.length === 0 ? (
                  <option value="">暂无 Desktop 授权目录</option>
                ) : healthyLocalRoots.map((root) => (
                  <option key={root.path} value={root.path}>{root.path}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Web 只会把任务转发到 Desktop 已授权目录内执行，权限审批仍由 Web/Mobile 处理。
              </p>
            </div>
          )}
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded border border-input hover:bg-muted">
            取消
          </button>
          <button
            type="submit"
            disabled={loading || !name || localDesktopUnavailable}
            title={localDesktopUnavailable ? '请先连接 Desktop 后再创建本地工作区' : undefined}
            className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '创建中...' : '创建'}
          </button>
        </div>
      </form>
    </div>
  )
}
