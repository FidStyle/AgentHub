import { create } from 'zustand'

export interface RuntimeInfo {
  type: string
  available: boolean
  version: string | null
  authenticated: boolean
  launchable: boolean
  cliPath: string | null
  diagnosticCode: string
  diagnosticMessage: string
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

export interface AuthUser {
  id: string
  name: string | null
  email: string | null
  image: string | null
}

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
  user: AuthUser | null

  setConnectionState: (state: string) => void
  setRuntimes: (runtimes: RuntimeInfo[]) => void
  setRuntimeLoading: (loading: boolean) => void
  addActivity: (entry: Omit<ActivityEntry, 'id' | 'time'>) => void
  approveItem: (id: string) => void
  rejectItem: (id: string) => void
  setWebWorkspaceError: (error: string | null) => void
  setAuthError: (error: string | null) => void
  setUser: (user: AuthUser | null) => void
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
    { id: 'codex', name: 'Codex', status: 'pending', capabilities: [] },
    { id: 'claude_code', name: 'Claude Code', status: 'pending', capabilities: [] },
    { id: 'opencode', name: 'OpenCode', status: 'pending', capabilities: [] },
    { id: 'other', name: '其他 Runtime', status: 'pending', capabilities: [] },
  ],
  webWorkspaceError: null,
  authError: null,
  currentPage: 'workspace',
  selectedAgent: null,
  user: null,

  setConnectionState: (connectionState: string) => set({ connectionState }),
  setRuntimes: (runtimes: RuntimeInfo[]) => set((state) => ({
    runtimes,
    agents: state.agents.map((agent) => {
      const runtime = runtimes.find((item) => item.type === agent.id)
      if (!runtime) return agent.id === 'opencode' || agent.id === 'other' ? agent : { ...agent, status: 'pending', version: undefined, capabilities: [] }
      const ready = runtime.available && runtime.authenticated && runtime.launchable
      return {
        ...agent,
        status: ready ? 'connected' : 'pending',
        version: runtime.version ?? undefined,
        capabilities: ready ? ['本地 CLI', '已认证', '可启动'] : [],
      }
    }),
  })),
  setRuntimeLoading: (runtimeLoading: boolean) => set({ runtimeLoading }),
  addActivity: (entry: Omit<ActivityEntry, 'id' | 'time'>) => set((s) => ({
    activities: [...s.activities, { ...entry, id: String(Date.now()), time: new Date().toLocaleTimeString('zh-CN') }],
  })),
  approveItem: (id: string) => set((s) => ({ approvals: s.approvals.filter((a) => a.id !== id) })),
  rejectItem: (id: string) => set((s) => ({ approvals: s.approvals.filter((a) => a.id !== id) })),
  setWebWorkspaceError: (webWorkspaceError: string | null) => set({ webWorkspaceError }),
  setAuthError: (authError: string | null) => set({ authError }),
  setUser: (user: AuthUser | null) => set({ user, userName: user?.name || user?.email || '未登录' }),
  navigateTo: (currentPage: DesktopPage) => set({ currentPage }),
  enterSession: (agent: AgentConfig) => set({ selectedAgent: agent, currentPage: 'workspace' }),
}))
