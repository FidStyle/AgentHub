'use client'


interface SidebarProps {
  sessions: { id: string; name: string }[]
  currentId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

export function Sidebar({ sessions, currentId, onSelect, onNew }: SidebarProps) {
  return (
    <aside className="w-64 border-r bg-gray-50 flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-sm">会话列表</h2>
        <button
          onClick={onNew}
          className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          新建
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left px-4 py-3 text-sm border-b hover:bg-gray-100 ${
              currentId === s.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
            }`}
          >
            {s.name}
          </button>
        ))}
        {sessions.length === 0 && (
          <p className="p-4 text-xs text-gray-400">暂无会话，点击新建开始</p>
        )}
      </nav>
    </aside>
  )
}
