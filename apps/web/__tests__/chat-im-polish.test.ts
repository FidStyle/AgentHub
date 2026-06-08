import { describe, expect, it } from 'vitest'
import { artifactPreviewLabel, artifactTypeLabel, formatPanelTime } from '@/components/workspace/ArtifactPanel'
import { messageAutoScrollSignature, messagePreview, quotedContent, roleTypeLabel } from '@/components/workspace/ChatPanel'

describe('chat IM polish helpers', () => {
  it('builds a stable quoted message body for composer sends', () => {
    expect(quotedContent('  继续修改这个组件  ', null)).toBe('继续修改这个组件')
    expect(quotedContent('继续修改这个组件', {
      id: 'msg-1',
      author: '前端工程师',
      preview: '这里是原始建议',
    })).toBe('> 引用 前端工程师：这里是原始建议\n\n继续修改这个组件')
  })

  it('normalizes quoted previews without leaking whitespace-heavy content into compact UI', () => {
    expect(messagePreview('   \n\t   ')).toBe('空消息')
    expect(messagePreview('第一行\n\n第二行\t第三行', 20)).toBe('第一行 第二行 第三行')
    expect(messagePreview('这是一个很长的消息，需要在消息操作栏和引用草稿中被压缩展示', 12)).toBe('这是一个很长的消息，需要...')
  })

  it('uses role-agent contact labels instead of runtime names', () => {
    expect(roleTypeLabel({ id: 'a1', name: 'Orchestrator', is_orchestrator: true })).toBe('编排者')
    expect(roleTypeLabel({ id: 'a2', name: '测试', role_type: 'tester', is_orchestrator: false })).toBe('测试者')
    expect(roleTypeLabel({ id: 'a3', name: '自定义', role_type: 'domain-expert', is_orchestrator: false })).toBe('domain-expert')
  })

  it('changes the auto-scroll signature when message execution status changes', () => {
    const base = {
      id: 'msg-action',
      sessionId: 'session-001',
      role: 'agent' as const,
      content: '需要授权执行命令',
      createdAt: '2026-06-09T00:00:00.000Z',
      roleAgentId: 'agent-001',
      isPinned: false,
      parts: [{
        id: 'part-permission',
        type: 'permission' as const,
        actionId: 'action-001',
        status: 'pending' as const,
        title: '需要授权',
        description: '执行命令需要确认',
      }],
    }

    expect(messageAutoScrollSignature([base])).not.toBe(messageAutoScrollSignature([{
      ...base,
      visibleStatus: '已完成',
      parts: [{
        id: 'part-permission',
        type: 'permission' as const,
        actionId: 'action-001',
        status: 'completed' as const,
        title: '已执行',
        description: '命令执行完成',
      }],
    }]))
  })

  it('maps artifact card metadata to Chinese labels and preview states', () => {
    expect(artifactTypeLabel('html')).toBe('网页预览')
    expect(artifactTypeLabel('generic_file')).toBe('文件')
    expect(artifactPreviewLabel({ artifact_type: 'markdown', content: '# 文档' })).toBe('可预览')
    expect(artifactPreviewLabel({ artifact_type: 'generic_file', content: null })).toBe('需下载')
    expect(formatPanelTime('bad-date')).toBe('暂无时间')
  })
})
