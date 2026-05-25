import { create } from 'zustand'

export interface RuntimeInfo {
  type: string
  available: boolean
  version: string | null
  authenticated: boolean
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

  setConnectionState: (state: string) => void
  setRuntimes: (runtimes: RuntimeInfo[]) => void
  setRuntimeLoading: (loading: boolean) => void
  addActivity: (entry: Omit<ActivityEntry, 'id' | 'time'>) => void
  approveItem: (id: string) => void
  rejectItem: (id: string) => void
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

  setConnectionState: (connectionState: string) => set({ connectionState }),
  setRuntimes: (runtimes: RuntimeInfo[]) => set({ runtimes }),
  setRuntimeLoading: (runtimeLoading: boolean) => set({ runtimeLoading }),
  addActivity: (entry: Omit<ActivityEntry, 'id' | 'time'>) => set((s) => ({
    activities: [...s.activities, { ...entry, id: String(Date.now()), time: new Date().toLocaleTimeString('zh-CN') }],
  })),
  approveItem: (id: string) => set((s) => ({ approvals: s.approvals.filter((a) => a.id !== id) })),
  rejectItem: (id: string) => set((s) => ({ approvals: s.approvals.filter((a) => a.id !== id) })),
}))
