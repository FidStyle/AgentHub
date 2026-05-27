import { create } from 'zustand'

export interface RuntimeInfo {
  type: string
  available: boolean
  version: string | null
  authenticated: boolean
}

export type AgentStatus = 'connected' | 'pending'

export interface AgentConfig {
  id: string
  name: string
  status: AgentStatus
  version?: string
  capabilities?: string[]
}

export interface ActivityEntry {
  id: string
  time: string
  type: 'runtime' | 'action' | 'approval'
  status: 'success' | 'failed' | 'pending'
  message: string
  reason?: string
}

export interface ApprovalItem {
  id: string
  action: string
  risk: 'high' | 'medium'
  description: string
  createdAt: string
}

export type DesktopPage = 'workspace' | 'sessions' | 'agents' | 'approvals' | 'settings'

interface ConsoleState {
  connectionState: string
  deviceName: string
  userName: string
  lastHeartbeat: string | null
  runtimes: RuntimeInfo[]
  runtimeLoading: boolean
  activities: ActivityEntry[]
  approvals: ApprovalItem[]
  workspaceDirs: { path: string; healthy: boolean }[]
  agents: AgentConfig[]
  webWorkspaceError: string | null
  authError: string | null
  currentPage: DesktopPage
  selectedAgent: AgentConfig | null

  setConnectionState: (state: string) => void
  setRuntimes: (runtimes: RuntimeInfo[]) => void
  setRuntimeLoading: (loading: boolean) => void
  addActivity: (entry: Omit<ActivityEntry, 'id' | 'time'>) => void
  approveItem: (id: string) => void
  rejectItem: (id: string) => void
  setWebWorkspaceError: (error: string | null) => void
  setAuthError: (error: string | null) => void
  navigateTo: (page: DesktopPage) => void
  enterSession: (agent: AgentConfig) => void
}

export const useConsoleStore = create<ConsoleState>((set) => ({
  connectionState: 'disconnected',
  deviceName: 'MacBook Pro',
  userName: '未登录',
  lastHeartbeat: null,
  runtimes: [],
  runtimeLoading: true,
  activities: [
    { id: '1', time: new Date().toLocaleTimeString('zh-CN'), type: 'runtime', status: 'success', message: '连接器已启动' },
  ],
  approvals: [
    { id: 'a1', action: '删除文件', risk: 'high', description: '删除 src/legacy/ 目录下 12 个文件', createdAt: '2 分钟前' },
  ],
  workspaceDirs: [
    { path: '~/Projects/agenthub', healthy: true },
    { path: '~/Projects/api-server', healthy: true },
  ],
  agents: [
    { id: 'codex', name: 'Codex', status: 'connected', version: '0.1.2', capabilities: ['代码生成', '代码审查', '测试生成'] },
    { id: 'claude_code', name: 'Claude Code', status: 'connected', version: '1.0.6', capabilities: ['代码生成', '重构', '调试'] },
    { id: 'opencode', name: 'OpenCode', status: 'pending', capabilities: [] },
    { id: 'other', name: '其他 Runtime', status: 'pending', capabilities: [] },
  ],
  webWorkspaceError: null,
  authError: null,
  currentPage: 'workspace',
  selectedAgent: null,

  setConnectionState: (connectionState: string) => set({ connectionState }),
  setRuntimes: (runtimes: RuntimeInfo[]) => set({ runtimes }),
  setRuntimeLoading: (runtimeLoading: boolean) => set({ runtimeLoading }),
  addActivity: (entry: Omit<ActivityEntry, 'id' | 'time'>) => set((s) => ({
    activities: [...s.activities, { ...entry, id: String(Date.now()), time: new Date().toLocaleTimeString('zh-CN') }],
  })),
  approveItem: (id: string) => set((s) => ({ approvals: s.approvals.filter((a) => a.id !== id) })),
  rejectItem: (id: string) => set((s) => ({ approvals: s.approvals.filter((a) => a.id !== id) })),
  setWebWorkspaceError: (webWorkspaceError: string | null) => set({ webWorkspaceError }),
  setAuthError: (authError: string | null) => set({ authError }),
  navigateTo: (currentPage: DesktopPage) => set({ currentPage }),
  enterSession: (agent: AgentConfig) => set({ selectedAgent: agent, currentPage: 'workspace' }),
}))
