'use client'


interface SidebarProps {
  sessions: { id: string; name: string }[]
  currentId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

export function Sidebar({ sessions, currentId, onSelect, onNew }: SidebarProps) {
  return (
    <aside className="w-64 border-r border-border bg-muted/50 flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-sm">会话列表</h2>
        <button
          onClick={onNew}
          className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          新建
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left px-4 py-3 text-sm border-b border-border hover:bg-muted ${
              currentId === s.id ? 'bg-accent border-l-2 border-l-primary' : ''
            }`}
          >
            {s.name}
          </button>
        ))}
        {sessions.length === 0 && (
          <p className="p-4 text-xs text-muted-foreground">暂无会话，点击新建开始</p>
        )}
      </nav>
    </aside>
  )
}
