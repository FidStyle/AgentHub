import { describe, expect, it } from 'vitest'
import {
  defaultPresentationDeck,
  parsePresentationDeck,
  serializePresentationDeck,
} from '@/lib/artifacts/rich-artifacts'
import { createDocxBuffer, createPptxBuffer } from '@/lib/artifacts/rich-artifact-export'

describe('rich artifact helpers', () => {
  it('parses and serializes presentation deck content', () => {
    const deck = defaultPresentationDeck('季度复盘')
    const parsed = parsePresentationDeck(serializePresentationDeck(deck), '备用标题')

    expect(parsed.title).toBe('季度复盘')
    expect(parsed.slides.length).toBeGreaterThan(1)
    expect(parsed.slides[0].body).toContain('AgentHub 演示稿产物')
  })

  it('falls back from plain text to a single-slide deck', () => {
    const parsed = parsePresentationDeck('第一页\n要点 A\n要点 B', '文本演示稿')

    expect(parsed.title).toBe('文本演示稿')
    expect(parsed.slides).toEqual([
      expect.objectContaining({
        title: '文本演示稿',
        body: ['要点 A', '要点 B'],
      }),
    ])
  })

  it('exports document and presentation as OpenXML zip files', () => {
    const docx = createDocxBuffer('富文档', '# 富文档\n\n正文')
    const pptx = createPptxBuffer(defaultPresentationDeck('演示稿'))

    expect(docx.subarray(0, 4).toString('hex')).toBe('504b0304')
    expect(pptx.subarray(0, 4).toString('hex')).toBe('504b0304')
    expect(docx.includes(Buffer.from('word/document.xml'))).toBe(true)
    expect(pptx.includes(Buffer.from('ppt/presentation.xml'))).toBe(true)
  })
})
