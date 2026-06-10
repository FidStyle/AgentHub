import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import type { RuntimeMessagePart } from '@agenthub/shared'
import type { createClient } from '@/lib/app-db-client'
import { createPptxBuffer } from '@/lib/artifacts/rich-artifact-export'
import { defaultPresentationDeck, parsePresentationDeck, serializePresentationDeck, type PresentationDeck } from '@/lib/artifacts/rich-artifacts'

type AppDb = Awaited<ReturnType<typeof createClient>>

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-').replace(/^-|-$/g, '').slice(0, 64) || `deck-${Date.now()}`
}

async function writePptxWithGenerator(input: {
  deck: PresentationDeck
  artifactDir: string
  pptxPath: string
}) {
  const command = process.env.PPT_MASTER_GENERATE_COMMAND || process.env.PPT_MASTER_COMMAND
  if (!command) {
    await writeFile(input.pptxPath, createPptxBuffer(input.deck))
    return { generator: 'agenthub-openxml-fallback', pptMasterStatus: process.env.PPT_MASTER_HOME ? 'configured_not_used' : 'not_configured' }
  }

  const deckJsonPath = path.join(input.artifactDir, 'deck.agenthub.json')
  await writeFile(deckJsonPath, JSON.stringify(input.deck, null, 2), 'utf8')
  const generated = spawnSync(command, [deckJsonPath, input.pptxPath], { encoding: 'utf8', timeout: 120_000 })
  if (generated.status === 0) {
    try {
      await access(input.pptxPath)
      return { generator: 'ppt-master-wrapper', pptMasterStatus: 'used', pptMasterCommand: command }
    } catch {
      // Fall back to the built-in OpenXML generator below.
    }
  }

  await writeFile(input.pptxPath, createPptxBuffer(input.deck))
  return {
    generator: 'agenthub-openxml-fallback',
    pptMasterStatus: 'fallback_after_error',
    pptMasterCommand: command,
    pptMasterError: generated.stderr || 'ppt-master wrapper 未生成 PPTX，已回退到内置 OpenXML 生成器。',
  }
}

function buildPresentationDeck(input: {
  title: string
  prompt?: string | null
  sourceContent?: string | null
}) {
  if (input.sourceContent) return parsePresentationDeck(input.sourceContent, input.title)
  if (!input.prompt) return defaultPresentationDeck(input.title)
  return {
    ...defaultPresentationDeck(input.title),
    slides: [
      {
        title: input.title,
        body: [
          input.prompt.slice(0, 120),
          '由演示稿工程师根据对话需求生成，可下载为可编辑 PPTX。',
        ],
      },
      ...defaultPresentationDeck(input.title).slides.slice(1),
    ],
  }
}

function sourcePathInsideWorkspace(workspaceRoot: string, sourcePath: string) {
  const fullPath = path.resolve(workspaceRoot, sourcePath)
  const normalizedRoot = path.resolve(workspaceRoot)
  if (path.isAbsolute(sourcePath) || sourcePath.split(/[\\/]/).includes('..')) {
    throw new Error('PPT 来源路径必须位于当前 workspace 内')
  }
  if (fullPath !== normalizedRoot && !fullPath.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error('PPT 来源路径必须位于当前 workspace 内')
  }
  return fullPath
}

async function artifactAssistantRoleId(db: AppDb, workspaceId: string) {
  const { data } = await db
    .from('role_agents')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
  const rows = Array.isArray(data) ? data as Array<{ id?: string }> : []
  return rows.find((row) => (row as { name?: string }).name === '产物助手')?.id ?? null
}

async function persistPresentationArtifactMessage(input: {
  db: AppDb
  workspaceId: string
  sessionId: string | null
  artifactId: string
  title: string
  sourcePath: string
  contentRef: string
}) {
  if (!input.sessionId) return
  const roleAgentId = await artifactAssistantRoleId(input.db, input.workspaceId)
  const previewUrl = `/m/preview?artifactId=${encodeURIComponent(input.artifactId)}`
  const downloadUrl = `/api/artifacts/${encodeURIComponent(input.artifactId)}/download`
  const parts: RuntimeMessagePart[] = [{
    id: `artifact-${input.artifactId}`,
    type: 'artifact',
    status: 'created',
    artifactId: input.artifactId,
    artifactType: 'presentation',
    title: input.title,
    sourcePath: input.sourcePath,
    contentRef: input.contentRef,
    previewUrl,
    downloadUrl,
  }, {
    id: `presentation-preview-${input.artifactId}`,
    type: 'presentation_preview',
    status: 'created',
    artifactId: input.artifactId,
    title: input.title,
    sourcePath: input.sourcePath,
    previewUrl,
    downloadUrl,
    summary: '演示稿工程师已生成 PPTX，产物助手已完成登记，可预览或下载。',
    previewKind: 'summary',
  }]
  await input.db.from('messages').insert({
    session_id: input.sessionId,
    sender_type: roleAgentId ? 'agent' : 'system',
    role_agent_id: roleAgentId,
    content: [
      '产物助手已完成演示稿收口。',
      `演示稿：${input.title}`,
      `来源：${input.sourcePath}`,
    ].join('\n'),
    message_type: 'result_card',
    metadata: {
      visibleStatus: '已完成',
      artifactCreated: {
        artifactId: input.artifactId,
        artifactType: 'presentation',
        sourcePath: input.sourcePath,
      },
      runtimeParts: parts,
    },
  })
}

export async function createPresentationArtifact(input: {
  db: AppDb
  userId: string
  workspaceId: string
  workspaceRoot: string
  sessionId?: string | null
  title: string
  prompt?: string | null
  sourcePath?: string | null
  sourceMessageId?: string | null
  persistMessage?: boolean
}) {
  const sourceContent = input.sourcePath
    ? await readFile(sourcePathInsideWorkspace(input.workspaceRoot, input.sourcePath), 'utf8').catch(() => '')
    : ''
  const deck = buildPresentationDeck({
    title: input.title,
    prompt: input.prompt,
    sourceContent,
  })
  const content = serializePresentationDeck(deck)
  const slug = slugify(input.title)
  const artifactDir = path.join(input.workspaceRoot, 'artifacts', slug)
  await mkdir(artifactDir, { recursive: true })
  const pptxPath = path.join(artifactDir, 'deck.pptx')
  const generatorMetadata = await writePptxWithGenerator({ deck, artifactDir, pptxPath })
  const sourceArtifactPath = path.relative(input.workspaceRoot, pptxPath).replace(/\\/g, '/')
  const contentRef = `workspace-file:${input.workspaceId}:${sourceArtifactPath}`

  const { data, error } = await input.db.from('artifacts').insert({
    workspace_id: input.workspaceId,
    session_id: input.sessionId ?? null,
    source_message_id: input.sourceMessageId ?? null,
    source_run_id: null,
    source_path: sourceArtifactPath,
    artifact_type: 'presentation',
    title: input.title,
    content,
    content_ref: contentRef,
    metadata: {
      kind: 'presentation_generated',
      ...generatorMetadata,
      sourcePath: input.sourcePath ?? null,
      pptxPath: sourceArtifactPath,
      workspaceDownloadUrl: `/api/workspaces/${input.workspaceId}/files/download?path=${encodeURIComponent(sourceArtifactPath)}`,
      previewStatus: 'summary',
      previewKind: 'presentation',
      slides: deck.slides.map((slide, index) => ({ index: index + 1, title: slide.title, body: slide.body })),
    },
    created_by: input.userId,
  }).select().single()
  if (error || !data?.id) throw new Error(error?.message ?? 'PPTX 产物写入失败')

  if (input.persistMessage !== false) {
    await persistPresentationArtifactMessage({
      db: input.db,
      workspaceId: input.workspaceId,
      sessionId: input.sessionId ?? null,
      artifactId: String(data.id),
      title: input.title,
      sourcePath: sourceArtifactPath,
      contentRef,
    })
  }

  return {
    artifact: data,
    pptxPath: sourceArtifactPath,
    contentRef,
  }
}
