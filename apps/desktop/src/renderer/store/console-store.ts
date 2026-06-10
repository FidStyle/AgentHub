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
  type: 'runtime' | 'action' | 'authorization'
  status: 'success' | 'failed' | 'pending'
  message: string
  reason?: string
}

export type PermissionPreset = 'sandbox' | 'standard' | 'auto' | 'full_control'

export interface PolicyPresetItem {
  id: string
  preset: PermissionPreset
  label: string
  description: string
  enabled: boolean
}

export type DesktopPage = 'workspace' | 'agents' | 'policy' | 'logs' | 'settings'

export interface AuthUser {
  id: string
  name: string | null
  email: string | null
  image: string | null
}

export interface NativeSessionRecord {
  key: string
  runtimeType: 'claude_code' | 'codex'
  runtimeName: string
  cwd: string
  nativeSessionId: string
  updatedAt: string
}

interface ConsoleState {
  connectionState: string
  deviceName: string
  userName: string
  lastHeartbeat: string | null
  runtimes: RuntimeInfo[]
  runtimeLoading: boolean
  activities: ActivityEntry[]
  permissionPreset: PermissionPreset
  policyPresets: PolicyPresetItem[]
  workspaceDirs: { path: string; healthy: boolean }[]
  agents: AgentConfig[]
  webWorkspaceError: string | null
  authError: string | null
  currentPage: DesktopPage
  selectedAgent: AgentConfig | null
  user: AuthUser | null
  nativeSessions: Record<string, NativeSessionRecord>

  setConnectionState: (state: string) => void
  setRuntimes: (runtimes: RuntimeInfo[]) => void
  setRuntimeLoading: (loading: boolean) => void
  addActivity: (entry: Omit<ActivityEntry, 'id' | 'time'>) => void
  setWorkspaceDirs: (workspaceDirs: { path: string; healthy: boolean }[]) => void
  setPermissionPreset: (preset: PermissionPreset) => void
  setWebWorkspaceError: (error: string | null) => void
  setAuthError: (error: string | null) => void
  setUser: (user: AuthUser | null) => void
  setNativeSession: (record: Omit<NativeSessionRecord, 'key' | 'updatedAt'>) => void
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
  permissionPreset: 'standard',
  policyPresets: [
    { id: 'sandbox', preset: 'sandbox', label: '沙箱模式', description: '只读或受限执行，写入和高风险动作需要 Web/Mobile 授权。', enabled: false },
    { id: 'standard', preset: 'standard', label: '标准模式', description: '允许工作区内常规读写、测试和构建；删除、部署、越界和敏感命令需要授权。', enabled: true },
    { id: 'auto', preset: 'auto', label: '自动执行', description: '本 Session 内常规动作自动继续；高风险动作仍需授权。', enabled: false },
    { id: 'full_control', preset: 'full_control', label: '完全控制', description: '当前 workspace/device 范围内最大授权，仍保留审计、撤销和安全阻断。', enabled: false },
  ],
  workspaceDirs: [
    { path: '~/.agenthub/cloud-workspaces', healthy: true },
    { path: '~/.agenthub/workspaces/default', healthy: true },
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
  nativeSessions: {},

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
  setWorkspaceDirs: (workspaceDirs) => set({ workspaceDirs }),
  setPermissionPreset: (permissionPreset: PermissionPreset) => set((s) => ({
    permissionPreset,
    policyPresets: s.policyPresets.map((item) => ({ ...item, enabled: item.preset === permissionPreset })),
  })),
  setWebWorkspaceError: (webWorkspaceError: string | null) => set({ webWorkspaceError }),
  setAuthError: (authError: string | null) => set({ authError }),
  setUser: (user: AuthUser | null) => set({ user, userName: user?.name || user?.email || '未登录' }),
  setNativeSession: (record) => set((state) => {
    const key = `${record.runtimeType}:${record.cwd}`
    return {
      nativeSessions: {
        ...state.nativeSessions,
        [key]: {
          ...record,
          key,
          updatedAt: new Date().toLocaleTimeString('zh-CN'),
        },
      },
    }
  }),
  navigateTo: (currentPage: DesktopPage) => set({ currentPage }),
  enterSession: (agent: AgentConfig) => set({ selectedAgent: agent, currentPage: 'workspace' }),
}))
