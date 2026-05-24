import { describe, it, expect } from 'vitest'
import type { Workspace, Session, Message, RoleAgent, RuntimeBinding } from '../domain'
import { FR_IDS } from '../constants'

describe('Domain Types', () => {
  it('Workspace 类型可正确实例化', () => {
    const ws: Workspace = {
      id: 'ws-1',
      name: '测试工作区',
      userId: 'user-1',
      executionDomain: 'local_desktop',
      createdAt: new Date(),
    }
    expect(ws.executionDomain).toBe('local_desktop')
  })

  it('Session 类型可正确实例化', () => {
    const session: Session = {
      id: 'sess-1',
      workspaceId: 'ws-1',
      executionDomain: 'cloud',
      status: 'active',
      routingMode: 'orchestrated',
      createdAt: new Date(),
    }
    expect(session.routingMode).toBe('orchestrated')
  })

  it('Message 类型可正确实例化', () => {
    const msg: Message = {
      id: 'msg-1',
      sessionId: 'sess-1',
      type: 'text',
      content: '你好',
      senderType: 'user',
      senderId: 'user-1',
      streamingStatus: 'complete',
      createdAt: new Date(),
    }
    expect(msg.senderType).toBe('user')
  })

  it('FR-ID 常量完整', () => {
    expect(FR_IDS.AUTH_001).toBe('FR-AUTH-001')
    expect(FR_IDS.WS_001).toBe('FR-WS-001')
    expect(FR_IDS.RUNTIME_001).toBe('FR-RUNTIME-001')
    expect(FR_IDS.PERM_001).toBe('FR-PERM-001')
    expect(Object.keys(FR_IDS).length).toBeGreaterThanOrEqual(16)
  })
})
