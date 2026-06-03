export type ArtifactDbType =
  | 'html'
  | 'markdown'
  | 'code'
  | 'image'
  | 'diff'
  | 'folder'
  | 'document'
  | 'presentation'
  | 'generic_file'

export type PresentationSlide = {
  title: string
  body: string[]
  notes?: string
}

export type PresentationDeck = {
  version: 1
  title: string
  slides: PresentationSlide[]
}

export const ARTIFACT_TYPES = new Set<ArtifactDbType>([
  'html',
  'markdown',
  'code',
  'image',
  'diff',
  'folder',
  'document',
  'presentation',
  'generic_file',
])

export function artifactTypeForPath(filePath: string): ArtifactDbType | null {
  const ext = filePath.toLowerCase().match(/\.[^./\\]+$/)?.[0] ?? ''
  if (ext === '.docx' || ext === '.doc' || ext === '.md' || ext === '.markdown') return 'document'
  if (ext === '.pptx' || ext === '.ppt') return 'presentation'
  return null
}

export function defaultDocumentContent(title: string) {
  return [
    `# ${title || '富文档'}`,
    '',
    '## 摘要',
    '',
    '这是一份可编辑的 AgentHub 富文档产物。',
    '',
    '## 下一步',
    '',
    '- 在右侧编辑区调整正文',
    '- 保存后可继续让 Agent 根据修改意图迭代',
  ].join('\n')
}

export function defaultPresentationDeck(title: string): PresentationDeck {
  const deckTitle = title || '演示稿'
  return {
    version: 1,
    title: deckTitle,
    slides: [
      {
        title: deckTitle,
        body: ['AgentHub 演示稿产物', '支持预览、基础编辑和导出'],
      },
      {
        title: '核心内容',
        body: ['在右侧编辑区维护每页标题和要点', '保存后可记录二次交互编辑请求'],
      },
      {
        title: '后续迭代',
        body: ['可继续让 Agent 改写、扩展或调整结构', '协同编辑不在当前任务范围内'],
      },
    ],
  }
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean)
  if (typeof value === 'string') return value.split('\n').map((item) => item.trim()).filter(Boolean)
  return []
}

export function parsePresentationDeck(content: string | null | undefined, fallbackTitle: string): PresentationDeck {
  if (content) {
    try {
      const parsed = JSON.parse(content) as Partial<PresentationDeck>
      const slides = Array.isArray(parsed.slides)
        ? parsed.slides.map((slide) => ({
          title: String((slide as Partial<PresentationSlide>).title || '未命名页面'),
          body: asStringArray((slide as Partial<PresentationSlide>).body),
          notes: (slide as Partial<PresentationSlide>).notes ? String((slide as Partial<PresentationSlide>).notes) : undefined,
        })).filter((slide) => slide.title || slide.body.length)
        : []
      if (slides.length > 0) {
        return {
          version: 1,
          title: String(parsed.title || fallbackTitle || '演示稿'),
          slides,
        }
      }
    } catch {
      const lines = content.split('\n').map((line) => line.trim()).filter(Boolean)
      if (lines.length > 0) {
        return {
          version: 1,
          title: fallbackTitle || lines[0],
          slides: [{
            title: fallbackTitle || lines[0],
            body: lines.slice(1),
          }],
        }
      }
    }
  }
  return defaultPresentationDeck(fallbackTitle)
}

export function serializePresentationDeck(deck: PresentationDeck) {
  return JSON.stringify(deck, null, 2)
}
