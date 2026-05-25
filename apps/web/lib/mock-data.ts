import type { Session, Message } from '@/store/session-store'

export const mockSessions: Session[] = [
  { id: 's1', title: '项目架构讨论', lastMessage: '好的，我来分析一下...', updatedAt: '2026-05-25T10:00:00Z' },
  { id: 's2', title: '代码审查：认证模块', lastMessage: '这个实现有安全隐患', updatedAt: '2026-05-25T09:30:00Z' },
  { id: 's3', title: '部署流程优化', lastMessage: '建议使用蓝绿部署', updatedAt: '2026-05-25T08:00:00Z' },
]

export const mockMessages: Message[] = [
  { id: 'm1', sessionId: 's1', role: 'user', content: '请帮我分析当前项目的架构设计', createdAt: '2026-05-25T10:00:00Z' },
  { id: 'm2', sessionId: 's1', role: 'agent', content: '好的，我来分析一下当前的架构。项目采用 monorepo 结构，包含 web、desktop 和 mobile 三端...', createdAt: '2026-05-25T10:00:30Z' },
  { id: 'm3', sessionId: 's1', role: 'user', content: '有什么改进建议吗？', createdAt: '2026-05-25T10:01:00Z' },
  { id: 'm4', sessionId: 's2', role: 'user', content: '请审查认证模块的代码', createdAt: '2026-05-25T09:30:00Z' },
  { id: 'm5', sessionId: 's2', role: 'agent', content: '这个实现有安全隐患，建议使用 httpOnly cookie 替代 localStorage 存储 token。', createdAt: '2026-05-25T09:30:30Z' },
  { id: 'm6', sessionId: 's3', role: 'user', content: '当前部署流程太慢了', createdAt: '2026-05-25T08:00:00Z' },
  { id: 'm7', sessionId: 's3', role: 'agent', content: '建议使用蓝绿部署策略，可以将部署时间从 15 分钟缩短到 3 分钟。', createdAt: '2026-05-25T08:00:30Z' },
]
