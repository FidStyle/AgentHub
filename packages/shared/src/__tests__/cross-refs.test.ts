import { describe, it, expect } from 'vitest'
import type {
  ActionRequest,
  PendingApproval,
  RuntimeBinding,
  RuntimeSession,
  RoleAgent,
  Artifact,
} from '../domain'
import { FR_IDS, type FrId } from '../constants'

describe('Domain Cross-References', () => {
  it('ActionRequest 引用 ExecutionDomain', () => {
    const action: ActionRequest = {
      id: 'act-1',
      sessionId: 'sess-1',
      type: 'shell',
      executionDomain: 'local_desktop',
      workingDir: '/tmp',
      riskLevel: 'high',
      status: 'pending',
      command: 'ls',
    }
    expect(action.executionDomain).toBe('local_desktop')
    expect(action.riskLevel).toBe('high')
  })

  it('PendingApproval 引用 RiskLevel', () => {
    const approval: PendingApproval = {
      id: 'apv-1',
      sourceType: 'action',
      sourceId: 'act-1',
      riskLevel: 'critical',
      status: 'pending',
    }
    expect(approval.riskLevel).toBe('critical')
  })

  it('RuntimeBinding 引用 ExecutionDomain', () => {
    const binding: RuntimeBinding = {
      id: 'rb-1',
      workspaceId: 'ws-1',
      roleAgentId: 'ra-1',
      runtimeType: 'claude_code',
      executionDomain: 'local_desktop',
    }
    expect(binding.runtimeType).toBe('claude_code')
  })

  it('RuntimeSession 状态流转', () => {
    const session: RuntimeSession = {
      id: 'rs-1',
      sessionId: 'sess-1',
      roleAgentId: 'ra-1',
      runtimeType: 'claude_code',
      nativeSessionId: null,
      cwd: '/workspace',
      status: 'running',
      capabilitySnapshot: {
        runtimeType: 'claude_code',
        available: true,
        authenticated: true,
        launchable: true,
        supportsResume: true,
        supportsContinue: true,
        version: '1.0.0',
      },
    }
    expect(session.runtimeType).toBe('claude_code')
    expect(session.capabilitySnapshot?.supportsResume).toBe(true)
  })

  it('RoleAgent 角色类型', () => {
    const agent: RoleAgent = {
      id: 'ra-1',
      workspaceId: 'ws-1',
      name: '代码审查员',
      roleType: 'reviewer',
      systemPrompt: 'Review code',
      capabilities: ['code_review'],
      runtimeType: 'codex',
      allowOrchestration: false,
    }
    expect(agent.runtimeType).toBe('codex')
    expect(agent.allowOrchestration).toBe(false)
  })

  it('Artifact 类型枚举', () => {
    const artifact: Artifact = {
      id: 'art-1',
      messageId: 'msg-1',
      type: 'code',
      content: 'console.log("hello")',
      metadata: { language: 'typescript' },
    }
    expect(artifact.type).toBe('code')
  })
})

describe('FR-ID Type Safety', () => {
  it('FR_IDS 值符合 FR-XXX-NNN 格式', () => {
    const pattern = /^FR-[A-Z]+-\d{3}$/
    for (const [, value] of Object.entries(FR_IDS)) {
      expect(value).toMatch(pattern)
    }
  })

  it('FrId 类型约束有效', () => {
    const id: FrId = FR_IDS.AUTH_001
    expect(id).toBe('FR-AUTH-001')
  })
})
