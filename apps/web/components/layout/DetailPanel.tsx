'use client'

import { useState, useEffect } from 'react'

interface RoleAgent {
  id: string
  workspace_id: string
  name: string
  role_type: string
  system_prompt: string
  capabilities: string[]
  is_orchestrator: boolean
  created_at: string
  updated_at: string
}

interface SelectedMessageDetail {
  id: string
  message_type: string
  sender_type: string
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
}

interface DetailPanelProps {
  workspaceId?: string
  selectedMessage?: SelectedMessageDetail | null
  onCloseMessage?: () => void
}

export function DetailPanel({ workspaceId, selectedMessage, onCloseMessage }: DetailPanelProps) {
  const [agents, setAgents] = useState<RoleAgent[]>([])
  const [selected, setSelected] = useState<RoleAgent | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<RoleAgent>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!workspaceId) return
    fetchAgents()
  }, [workspaceId])

  async function fetchAgents() {
    if (!workspaceId) return
    setLoading(true)
    const res = await fetch(`/api/role-agents?workspace_id=${workspaceId}`)
    if (res.ok) {
      const data = await res.json()
      setAgents(data)
      if (data.length > 0 && !selected) setSelected(data[0])
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    const res = await fetch(`/api/role-agents/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const updated = await res.json()
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      setSelected(updated)
      setEditing(false)
      setForm({})
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!selected) return
    if (!confirm('确定要删除此 Agent 吗？')) return
    const res = await fetch(`/api/role-agents/${selected.id}`, { method: 'DELETE' })
    if (res.ok) {
      const remaining = agents.filter((a) => a.id !== selected.id)
      setAgents(remaining)
      setSelected(remaining[0] || null)
    }
  }

  async function handleCreate() {
    if (!workspaceId) return
    const res = await fetch('/api/role-agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspaceId,
        name: '新 Agent',
        role_type: 'general',
        system_prompt: '',
        capabilities: [],
        is_orchestrator: false,
      }),
    })
    if (res.ok) {
      const agent = await res.json()
      setAgents((prev) => [...prev, agent])
      setSelected(agent)
      setEditing(true)
    }
  }

  if (!workspaceId) {
    return (
      <aside className="w-72 border-l bg-gray-50 hidden lg:flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Agent 配置</h3>
        </div>
        <div className="flex-1 p-4">
          <p className="text-xs text-gray-400">请先选择一个 Workspace</p>
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-72 border-l bg-gray-50 hidden lg:flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">Agent 配置</h3>
      </div>

      {/* Agent 列表 */}
      <div className="border-b">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs font-medium text-gray-600">Agent 列表</span>
          <button
            onClick={handleCreate}
            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            + 新建
          </button>
        </div>
        <div className="max-h-32 overflow-y-auto">
          {loading ? (
            <p className="text-xs text-gray-400 px-3 py-2">加载中...</p>
          ) : agents.length === 0 ? (
            <p className="text-xs text-gray-400 px-3 py-2">暂无 Agent</p>
          ) : (
            agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => { setSelected(agent); setEditing(false) }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 ${
                  selected?.id === agent.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                }`}
              >
                {agent.name}
                {agent.is_orchestrator && <span className="ml-1 text-blue-500">*</span>}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Agent 配置表单 */}
      {selectedMessage ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Artifact Detail</h4>
            <button
              onClick={onCloseMessage}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Close
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex gap-2">
              <span className="text-gray-500">Type:</span>
              <span className="font-medium">{selectedMessage.message_type}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500">Sender:</span>
              <span>{selectedMessage.sender_type}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500">Time:</span>
              <span>{new Date(selectedMessage.created_at).toLocaleString('zh-CN')}</span>
            </div>
            <div className="border-t pt-2">
              <span className="text-gray-500">Content:</span>
              <pre className="mt-1 whitespace-pre-wrap text-gray-700 max-h-48 overflow-y-auto">{selectedMessage.content}</pre>
            </div>
            {selectedMessage.metadata && (
              <div className="border-t pt-2">
                <span className="text-gray-500">Metadata:</span>
                <pre className="mt-1 whitespace-pre-wrap text-gray-700 text-xs font-mono max-h-48 overflow-y-auto">
                  {JSON.stringify(selectedMessage.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      ) : selected && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">名称</label>
            {editing ? (
              <input
                value={form.name ?? selected.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border rounded px-2 py-1 text-xs"
              />
            ) : (
              <p className="text-sm">{selected.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">角色类型</label>
            {editing ? (
              <select
                value={form.role_type ?? selected.role_type}
                onChange={(e) => setForm({ ...form, role_type: e.target.value })}
                className="w-full border rounded px-2 py-1 text-xs"
              >
                <option value="orchestrator">编排者</option>
                <option value="engineer">工程师</option>
                <option value="reviewer">审查者</option>
                <option value="tester">测试者</option>
                <option value="custom">自定义</option>
                <option value="general">通用</option>
              </select>
            ) : (
              <p className="text-sm">{selected.role_type}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">System Prompt</label>
            {editing ? (
              <textarea
                value={form.system_prompt ?? selected.system_prompt}
                onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
                rows={6}
                className="w-full border rounded px-2 py-1 text-xs font-mono"
              />
            ) : (
              <p className="text-xs text-gray-600 whitespace-pre-wrap">
                {selected.system_prompt || '（未设置）'}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is-orch"
              checked={form.is_orchestrator ?? selected.is_orchestrator}
              onChange={(e) => setForm({ ...form, is_orchestrator: e.target.checked })}
              disabled={!editing}
              className="w-4 h-4"
            />
            <label htmlFor="is-orch" className="text-xs">设为编排者</label>
          </div>

          <div className="flex gap-2 pt-2">
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-3 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '保存'}
                </button>
                <button
                  onClick={() => { setEditing(false); setForm({}) }}
                  className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                >
                  取消
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="flex-1 px-3 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                >
                  编辑
                </button>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 bg-red-50 text-red-600 text-xs rounded hover:bg-red-100"
                >
                  删除
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
