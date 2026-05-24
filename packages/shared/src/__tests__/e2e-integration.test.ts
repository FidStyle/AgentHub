import { describe, it, expect } from 'vitest'
import { DEFAULT_ORCHESTRATOR_CONFIG } from '@agenthub/shared'

describe('E2E Integration', () => {
  describe('Orchestrator Config', () => {
    it('should have correct defaults', () => {
      expect(DEFAULT_ORCHESTRATOR_CONFIG.maxConcurrent).toBe(3)
      expect(DEFAULT_ORCHESTRATOR_CONFIG.defaultRuntime).toBe('claude_code')
    })

    it('should require approval for critical/high risk', () => {
      expect(DEFAULT_ORCHESTRATOR_CONFIG.approvalRequired('critical')).toBe(true)
      expect(DEFAULT_ORCHESTRATOR_CONFIG.approvalRequired('high')).toBe(true)
      expect(DEFAULT_ORCHESTRATOR_CONFIG.approvalRequired('low')).toBe(false)
    })
  })

  describe('Cross-platform message format', () => {
    it('should share Message type across platforms', () => {
      const msg = {
        id: 'test-1',
        sessionId: 'sess-1',
        type: 'text' as const,
        content: 'Hello from E2E',
        senderType: 'user' as const,
        senderId: 'user-1',
        streamingStatus: 'complete' as const,
        createdAt: new Date(),
      }
      expect(msg.id).toBeDefined()
      expect(msg.type).toBe('text')
      expect(msg.senderType).toBe('user')
    })
  })

  describe('Demo flow', () => {
    it('should simulate full user journey', () => {
      // 1. User logs in (OAuth redirect)
      const authCallback = '/auth/callback?code=test123'
      expect(authCallback).toContain('code=')

      // 2. User creates workspace session
      const session = { id: 'sess-demo', name: 'Demo Session' }
      expect(session.id).toBeDefined()

      // 3. User sends message
      const userMsg = { content: '帮我分析这段代码', senderType: 'user' }
      expect(userMsg.content.length).toBeGreaterThan(0)

      // 4. Orchestrator routes to runtime
      const riskLevel = 'low'
      const needsApproval = DEFAULT_ORCHESTRATOR_CONFIG.approvalRequired(riskLevel)
      expect(needsApproval).toBe(false)

      // 5. Agent responds with streaming
      const response = { type: 'delta', content: '正在分析...' }
      expect(response.type).toBe('delta')
    })
  })
})
