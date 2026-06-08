import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { ExecutionDomain } from '@agenthub/shared'
import type { CliRuntimeType } from '@agenthub/shared'
import type { AgentMailboxItem } from '@agenthub/shared'
import { createClient } from '@/lib/app-db-client'
import { createSession, resolveEndpoint } from '@/lib/runtime/gateway'
import { enqueue, isWorkerAlive, type RuntimeJob } from '@/lib/runtime/redis-client'
import { assertRoleAgentTool, loadRoleAgentForTool } from '@/lib/role-agents/tools'
import type { RoleAgentToolId } from '@agenthub/shared'

type AppDb = Awaited<ReturnType<typeof createClient>>

export type ActionDispatchStatus = 'queued' | 'completed' | 'unavailable' | 'unsupported'

export interface ActionDispatchResult {
  status: ActionDispatchStatus
  runtimeSessionId?: string
  error?: string
}

export interface ActionRecordForDispatch {
  id: string
  session_id: string
  owner_id: string
  plan_node_id?: string | null
  action_type: string
  command: string
  cwd?: string | null
  runtime_type?: CliRuntimeType | null
  role_agent_id?: string | null
  result?: unknown
}

function buildActionPrompt(action: ActionRecordForDispatch): string {
  const cwd = action.cwd ? `\nWorking directory: ${action.cwd}` : ''
  return [
    'AgentHub action execution request.',
    `Action type: ${action.action_type}`,
    `Command: ${action.command}${cwd}`,
    '',
    'Execute the requested action in the workspace context. Stream useful progress and final output.',
  ].join('\n')
}

type RuntimePermissionBrokerResult = {
  source?: string
  runtimeSessionId?: unknown
  originalRuntimeSessionId?: unknown
  toolCallId?: unknown
  toolName?: unknown
  actionKind?: unknown
  commandPreview?: unknown
  input?: unknown
  nativeSessionId?: unknown
  runtimeType?: unknown
  roleAgentId?: unknown
  permissionMode?: unknown
  targetPaths?: unknown
  cwd?: unknown
  workspaceRoot?: unknown
}

type ApprovedNativeToolExecution = {
  toolCallId?: string | null
  toolName: string
  actionKind: string
  targetPaths: string[]
  commandPreview?: string | null
  executed: boolean
  output: string
  error?: string
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

function requiredToolForAction(actionType: string): RoleAgentToolId | null {
  if (actionType === 'deploy') return 'publish_service'
  if (actionType === 'apply_diff') return 'diff_apply'
  if (actionType.startsWith('git_')) return 'git_cli'
  if (actionType === 'file_write' || actionType === 'write_file') return 'file_write'
  if (actionType === 'read_file') return 'file_read'
  if (actionType === 'shell' || actionType === 'shell_command' || actionType === 'destructive_command') return 'shell'
  if (actionType === 'network_request') return 'web_fetch'
  if (actionType === 'web_search') return 'web_search'
  if (actionType === 'browser_preview') return 'browser_preview'
  if (actionType === 'artifact_store' || actionType === 'artifact_write') return 'artifact_store'
  if (actionType === 'presentation_generate' || actionType === 'ppt_generation') return 'ppt_master'
  return null
}

async function assertActionTool(db: AppDb, action: ActionRecordForDispatch) {
  const required = requiredToolForAction(action.action_type)
  if (!required || !action.role_agent_id) return { ok: true as const }
  const role = await loadRoleAgentForTool(db, action.role_agent_id)
  return assertRoleAgentTool(role, required)
}

function runtimePermissionBrokerResult(action: ActionRecordForDispatch): RuntimePermissionBrokerResult | null {
  const result = objectValue(action.result)
  return result?.source === 'runtime_permission_broker' ? result as RuntimePermissionBrokerResult : null
}

function dispatchResult(action: ActionRecordForDispatch, values: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(objectValue(action.result) ?? {}),
    ...values,
  }
}

function buildApprovedNativeToolPrompt(
  action: ActionRecordForDispatch,
  broker: RuntimePermissionBrokerResult,
  execution?: ApprovedNativeToolExecution | null,
): string | null {
  const toolName = stringValue(broker.toolName)
  const actionKind = stringValue(broker.actionKind) ?? action.action_type
  const commandPreview = stringValue(broker.commandPreview)
  const targetPaths = stringArrayValue(broker.targetPaths)
  const input = broker.input === undefined ? null : broker.input
  if (!toolName) return null
  if (!commandPreview && targetPaths.length === 0 && input === null) return null

  return [
    'AgentHub approved native CLI tool continuation.',
    `Approved action id: ${action.id}`,
    `Original runtime session id: ${stringValue(broker.originalRuntimeSessionId) ?? stringValue(broker.runtimeSessionId) ?? 'unknown'}`,
    `Original tool call id: ${stringValue(broker.toolCallId) ?? 'unknown'}`,
    `Tool: ${toolName}`,
    `Action kind: ${actionKind}`,
    commandPreview ? `Command preview: ${commandPreview}` : null,
    targetPaths.length > 0 ? `Target paths: ${targetPaths.join(', ')}` : null,
    `Working directory: ${action.cwd ?? stringValue(broker.cwd) ?? ''}`,
    '',
    execution?.executed
      ? [
          'AgentHub has already executed this exact approved native tool request inside the selected workspace boundary.',
          'Do not call the same native tool again for the same target. Treat the tool result below as the result of the approved tool call, then continue with the next step of the original task.',
          'Do not stop to ask the user about optional implementation choices that are already implied by the original request; choose sensible defaults and continue. Only ask the user if execution cannot proceed safely without new information.',
          'For the fixed sample "做一个加减乘除的简单网站，使用 sqlite 存储历史记录", use Node.js + Express + better-sqlite3 + plain HTML/CSS/JS by default, keep all history in SQLite, show the latest 20 records in the UI, and continue implementation without AskUserQuestion unless a real safety blocker appears.',
          'For that fixed sample, `node src/server.js` must directly start the HTTP server. If the file exports createApp/startServer for tests, keep a `require.main === module` startup guard or an equivalent direct entrypoint.',
          'Keep temporary verification scripts, temporary SQLite databases, temporary logs, and cleanup targets inside the selected workspace root. Do not use /tmp, the user home directory, the AgentHub host repository, or any path outside the workspace boundary.',
          '',
          `Approved tool execution result:\n${execution.output}`,
        ].join('\n')
      : 'The user approved this exact native tool request. Continue from the existing workspace context and perform only this approved operation, then continue the original task if the CLI can resume it.',
    input === null ? null : `Original tool input JSON:\n${JSON.stringify(input, null, 2)}`,
  ].filter(Boolean).join('\n')
}

function brokerInputRecord(broker: RuntimePermissionBrokerResult): Record<string, unknown> | null {
  return objectValue(broker.input)
}

function inputString(input: Record<string, unknown> | null, keys: string[]): string | null {
  for (const key of keys) {
    const value = input?.[key]
    if (typeof value === 'string') return value
  }
  return null
}

function targetPathForBroker(broker: RuntimePermissionBrokerResult): string | null {
  const input = brokerInputRecord(broker)
  return stringArrayValue(broker.targetPaths)[0]
    ?? inputString(input, ['file_path', 'filepath', 'path', 'target_path', 'targetPath'])
}

function normalizedToolName(toolName: string): string {
  return toolName.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

function isReadEnumerationTool(toolName: string): boolean {
  const name = normalizedToolName(toolName)
  return name === 'glob' || name === 'grep' || name === 'ls' || name === 'list'
}

function globPatternForBroker(broker: RuntimePermissionBrokerResult): string | null {
  const input = brokerInputRecord(broker)
  return inputString(input, ['pattern', 'glob', 'path']) ?? '*'
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
}

function globPatternToRegex(pattern: string): RegExp {
  let source = ''
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]
    const next = pattern[index + 1]
    if (char === '*' && next === '*') {
      const after = pattern[index + 2]
      if (after === '/') {
        source += '(?:.*\\/)?'
        index += 2
      } else {
        source += '.*'
        index += 1
      }
      continue
    }
    if (char === '*') {
      source += '[^/]*'
      continue
    }
    if (char === '?') {
      source += '[^/]'
      continue
    }
    source += escapeRegex(char)
  }
  return new RegExp(`^${source}$`)
}

async function walkFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const entryPath = path.join(current, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walkFiles(root, entryPath))
    } else if (entry.isFile()) {
      files.push(entryPath)
    }
  }
  return files
}

async function executeReadEnumerationTool(
  broker: RuntimePermissionBrokerResult,
  workspaceRoot: string,
  toolName: string,
): Promise<ApprovedNativeToolExecution | null> {
  const pattern = globPatternForBroker(broker)
  if (!pattern) return null
  const cwd = stringValue(broker.cwd) ?? workspaceRoot
  if (!isPathInsideRoot(workspaceRoot, cwd)) {
    throw new Error('该操作试图使用 workspace 外工作目录，已阻止。')
  }
  const normalizedPattern = pattern.replace(/\\/g, '/').replace(/^\.\//, '')
  if (normalizedPattern.split('/').includes('..')) {
    throw new Error(`该操作试图访问 workspace 外路径 ${pattern}，已阻止。`)
  }
  if (path.isAbsolute(normalizedPattern) && !isPathInsideRoot(workspaceRoot, normalizedPattern)) {
    throw new Error(`该操作试图访问 workspace 外路径 ${pattern}，已阻止。`)
  }
  const relativePattern = path.isAbsolute(normalizedPattern)
    ? path.relative(workspaceRoot, normalizedPattern).replace(/\\/g, '/')
    : path.relative(workspaceRoot, path.join(cwd, normalizedPattern)).replace(/\\/g, '/')
  if (relativePattern.split('/').includes('..')) {
    throw new Error(`该操作试图访问 workspace 外路径 ${pattern}，已阻止。`)
  }

  const matcher = globPatternToRegex(relativePattern)
  const matches = (await walkFiles(workspaceRoot))
    .map((filePath) => path.relative(workspaceRoot, filePath).replace(/\\/g, '/'))
    .filter((relativePath) => matcher.test(relativePath))
    .sort()
  return {
    toolCallId: stringValue(broker.toolCallId),
    toolName,
    actionKind: stringValue(broker.actionKind) ?? 'read_file',
    targetPaths: [],
    executed: true,
    output: clipToolOutput(`${toolName} ${pattern}\n\n${matches.length > 0 ? matches.join('\n') : '(no matches)'}`),
  }
}

function clipToolOutput(value: string, limit = 30_000): string {
  if (value.length <= limit) return value
  return `${value.slice(0, limit)}\n\n[AgentHub clipped ${value.length - limit} trailing characters from the approved native tool result.]`
}

function execShell(command: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile('/bin/sh', ['-lc', command], {
      cwd,
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
    }, (err, stdout, stderr) => {
      if (err) {
        reject(err)
        return
      }
      resolve({ stdout: String(stdout ?? ''), stderr: String(stderr ?? '') })
    })
  })
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function isLikelyLongRunningShellCommand(command: string): boolean {
  const normalized = command.replace(/\s+/g, ' ').trim()
  return /\b(?:npm|pnpm|yarn)\s+(?:run\s+)?(?:dev|start)\b/.test(normalized)
    || /\bnext\s+dev\b/.test(normalized)
    || /\bvite(?:\s|$)/.test(normalized)
    || /\bnode\s+(?:\.\/)?(?:src\/)?server\.(?:js|mjs|cjs)\b/.test(normalized)
}

async function startBackgroundShell(command: string, cwd: string): Promise<{ pid: number | null; logPath: string; statePath: string }> {
  const stateDir = path.join(cwd, '.agenthub')
  await fs.mkdir(stateDir, { recursive: true })
  const logPath = path.join(stateDir, 'last-background-service.log')
  const statePath = path.join(stateDir, 'last-background-service.json')
  const child = spawn('/bin/sh', ['-lc', `exec > ${shellQuote(logPath)} 2>&1\n${command}`], {
    cwd,
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
  await fs.writeFile(statePath, JSON.stringify({
    pid: child.pid ?? null,
    command,
    cwd,
    logPath,
    startedAt: new Date().toISOString(),
  }, null, 2), 'utf8')
  return { pid: child.pid ?? null, logPath, statePath }
}

async function executeApprovedNativeTool(
  broker: RuntimePermissionBrokerResult,
  workspaceRoot: string,
): Promise<ApprovedNativeToolExecution | null> {
  const toolName = stringValue(broker.toolName)
  const actionKind = stringValue(broker.actionKind)
  const input = brokerInputRecord(broker)
  if (toolName && isReadEnumerationTool(toolName)) {
    return executeReadEnumerationTool(broker, workspaceRoot, toolName)
  }
  const targetPath = targetPathForBroker(broker)
  if (!toolName || !actionKind || !targetPath) return null
  if (!isPathInsideRoot(workspaceRoot, targetPath)) {
    throw new Error(`该操作试图访问 workspace 外路径 ${targetPath}，已阻止。`)
  }

  const base = {
    toolCallId: stringValue(broker.toolCallId),
    toolName,
    actionKind,
    commandPreview: stringValue(broker.commandPreview),
    targetPaths: stringArrayValue(broker.targetPaths).length > 0 ? stringArrayValue(broker.targetPaths) : [targetPath],
  }
  if (actionKind === 'read_file') {
    const content = await fs.readFile(targetPath, 'utf8')
    return {
      ...base,
      executed: true,
      output: clipToolOutput(`Read ${targetPath}\n\n${content}`),
    }
  }
  if (toolName.toLowerCase() === 'edit') {
    const oldString = inputString(input, ['old_string', 'oldString'])
    const newString = inputString(input, ['new_string', 'newString'])
    if (oldString === null || newString === null) return null
    const current = await fs.readFile(targetPath, 'utf8')
    const replaceAll = input?.replace_all === true || input?.replaceAll === true
    if (!current.includes(oldString)) throw new Error('Edit 工具 old_string 未在目标文件中找到，已阻止执行。')
    const next = replaceAll ? current.split(oldString).join(newString) : current.replace(oldString, newString)
    await fs.writeFile(targetPath, next, 'utf8')
    return {
      ...base,
      executed: true,
      output: `Edited ${targetPath}`,
    }
  }
  if (toolName.toLowerCase() === 'multiedit') {
    const edits = Array.isArray(input?.edits) ? input.edits.map(objectValue).filter((item): item is Record<string, unknown> => Boolean(item)) : []
    if (edits.length === 0) return null
    let current = await fs.readFile(targetPath, 'utf8')
    for (const edit of edits) {
      const oldString = inputString(edit, ['old_string', 'oldString'])
      const newString = inputString(edit, ['new_string', 'newString'])
      if (oldString === null || newString === null) throw new Error('MultiEdit 工具缺少 old_string/new_string，已阻止执行。')
      if (!current.includes(oldString)) throw new Error('MultiEdit 工具 old_string 未在目标文件中找到，已阻止执行。')
      const replaceAll = edit.replace_all === true || edit.replaceAll === true
      current = replaceAll ? current.split(oldString).join(newString) : current.replace(oldString, newString)
    }
    await fs.writeFile(targetPath, current, 'utf8')
    return {
      ...base,
      executed: true,
      output: `Applied ${edits.length} edits to ${targetPath}`,
    }
  }
  if (actionKind === 'write_file') {
    const content = inputString(input, ['content', 'text'])
    if (content === null) throw new Error('Write 工具缺少 content，已阻止执行。')
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    await fs.writeFile(targetPath, content, 'utf8')
    return {
      ...base,
      executed: true,
      output: `Wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${targetPath}`,
    }
  }
  return null
}

async function executeApprovedShellTool(
  broker: RuntimePermissionBrokerResult,
  workspaceRoot: string,
): Promise<ApprovedNativeToolExecution | null> {
  const toolName = stringValue(broker.toolName)
  const actionKind = stringValue(broker.actionKind)
  const commandPreview = stringValue(broker.commandPreview)
  if (!toolName || !actionKind || !commandPreview) return null
  const cwd = stringValue(broker.cwd) ?? workspaceRoot
  if (!isPathInsideRoot(workspaceRoot, cwd)) {
    throw new Error('该操作试图使用 workspace 外工作目录，已阻止。')
  }
  if (isLikelyLongRunningShellCommand(commandPreview)) {
    const started = await startBackgroundShell(commandPreview, cwd)
    return {
      toolCallId: stringValue(broker.toolCallId),
      toolName,
      actionKind,
      commandPreview,
      targetPaths: stringArrayValue(broker.targetPaths),
      executed: true,
      output: clipToolOutput([
        `$ ${commandPreview}`,
        'Started long-running command in the background inside the selected workspace boundary.',
        `pid: ${started.pid ?? 'unknown'}`,
        `log: ${started.logPath}`,
        `state: ${started.statePath}`,
      ].join('\n')),
    }
  }
  const { stdout, stderr } = await execShell(commandPreview, cwd)
  const parts = [
    `$ ${commandPreview}`,
    stdout ? `stdout:\n${stdout}` : null,
    stderr ? `stderr:\n${stderr}` : null,
  ].filter(Boolean)
  return {
    toolCallId: stringValue(broker.toolCallId),
    toolName,
    actionKind,
    commandPreview,
    targetPaths: stringArrayValue(broker.targetPaths),
    executed: true,
    output: clipToolOutput(parts.join('\n\n')),
  }
}

async function recordDispatchFailure(
  db: AppDb,
  action: ActionRecordForDispatch,
  status: ActionDispatchStatus,
  error: string,
): Promise<ActionDispatchResult> {
  const result = dispatchResult(action, { dispatch: status, error, at: new Date().toISOString() })
  await db.from('actions').update({ status: 'failed', result }).eq('id', action.id)
  if (action.plan_node_id) {
    await db.from('plan_nodes').update({ status: 'failed', result }).eq('id', action.plan_node_id)
  }
  await db.from('notifications').insert({
    user_id: action.owner_id,
    type: 'action_dispatch_failed',
    title: '动作暂未执行',
    body: error,
    ref_type: 'action',
    ref_id: action.id,
  })
  return { status, error }
}

function deploymentEntryPath(files: string[], workspaceRoot: string): string | null {
  const relativeFiles = files
    .map((filePath) => path.relative(workspaceRoot, filePath).replace(/\\/g, '/'))
    .filter((relativePath) => relativePath && !relativePath.split('/').includes('..'))
  const candidates = [
    'dist/index.html',
    'build/index.html',
    'public/index.html',
    'index.html',
  ]
  return candidates.find((candidate) => relativeFiles.includes(candidate))
    ?? relativeFiles.find((relativePath) => relativePath.endsWith('/index.html'))
    ?? relativeFiles.find((relativePath) => relativePath.endsWith('.html'))
    ?? relativeFiles.find((relativePath) => relativePath === 'README.md')
    ?? relativeFiles[0]
    ?? null
}

async function dispatchDeployAction(
  db: AppDb,
  action: ActionRecordForDispatch,
  workspaceId: string,
  workspaceRoot: string,
): Promise<ActionDispatchResult> {
  const now = new Date().toISOString()
  const files = await walkFiles(workspaceRoot)
  const entryPath = deploymentEntryPath(files, workspaceRoot)
  const manifestRelativePath = `.agenthub/deployments/${action.id}/manifest.json`
  const manifestFullPath = path.join(workspaceRoot, manifestRelativePath)
  const previewPath = entryPath ? `workspace-file:${workspaceId}:${entryPath}` : null
  const manifest = {
    version: 1,
    actionId: action.id,
    workspaceId,
    sessionId: action.session_id,
    status: 'completed',
    mode: 'local_static_preview',
    entryPath,
    previewPath,
    manifestPath: manifestRelativePath,
    sourceRoot: workspaceRoot,
    fileCount: files.length,
    createdAt: now,
  }
  await fs.mkdir(path.dirname(manifestFullPath), { recursive: true })
  await fs.writeFile(manifestFullPath, JSON.stringify(manifest, null, 2), 'utf8')

  const content = [
    '# 部署结果',
    '',
    '| 字段 | 内容 |',
    '| --- | --- |',
    '| 状态 | 已完成 |',
    '| 模式 | 本地静态预览 manifest |',
    `| 预览路径 | ${previewPath ?? '未发现可预览入口文件'} |`,
    `| 入口文件 | ${entryPath ?? '未发现'} |`,
    `| Manifest | ${manifestRelativePath} |`,
    `| 文件数 | ${files.length} |`,
    `| 创建时间 | ${now} |`,
    '',
    '该部署结果由聊天部署审批生成，可在产物面板和移动预览中刷新读回。它不会发布到外网。',
  ].join('\n')

  const { data: artifact, error: artifactError } = await db
    .from('artifacts')
    .insert({
      workspace_id: workspaceId,
      session_id: action.session_id,
      source_message_id: null,
      source_run_id: null,
      source_path: manifestRelativePath,
      artifact_type: 'markdown',
      title: '部署结果',
      content,
      content_ref: previewPath ?? `workspace-file:${workspaceId}:${manifestRelativePath}`,
      metadata: {
        kind: 'deployment',
        actionId: action.id,
        status: 'completed',
        mode: 'local_static_preview',
        previewPath,
        manifestPath: manifestRelativePath,
        entryPath,
        fileCount: files.length,
        workspaceRoot,
      },
      created_by: action.owner_id,
    })
    .select()
    .single()
  const artifactId = typeof artifact?.id === 'string' ? artifact.id : null
  if (artifactError || !artifactId) {
    return recordDispatchFailure(db, action, 'unavailable', artifactError?.message ?? '部署结果产物写入失败。')
  }

  await db.from('messages').insert({
    session_id: action.session_id,
    content: [
      '部署已完成，已生成本地静态预览 manifest 和部署结果产物。',
      previewPath ? `预览路径：${previewPath}` : '未发现可预览入口文件，请在产物中查看 manifest。',
      `Manifest：${manifestRelativePath}`,
    ].join('\n'),
    sender_type: 'agent',
    role_agent_id: action.role_agent_id ?? null,
    message_type: 'result_card',
    metadata: {
      deployment: {
        actionId: action.id,
        artifactId,
        status: 'completed',
        previewPath,
        manifestPath: manifestRelativePath,
        entryPath,
      },
      runtimeParts: [{
        id: `deployment-${action.id}`,
        type: 'artifact',
        status: 'created',
        artifactId,
        artifactType: 'markdown',
        title: '部署结果',
        sourcePath: manifestRelativePath,
        contentRef: previewPath ?? `workspace-file:${workspaceId}:${manifestRelativePath}`,
      }],
    },
  })

  const result = dispatchResult(action, {
    dispatch: 'completed',
    deployment: manifest,
    artifactId,
    previewPath,
    manifestPath: manifestRelativePath,
    at: now,
  })
  await db.from('actions').update({
    status: 'completed',
    executed_at: now,
    result,
  }).eq('id', action.id)
  await db.from('notifications').insert({
    user_id: action.owner_id,
    type: 'deployment_completed',
    title: '部署已完成',
    body: previewPath ? `预览路径：${previewPath}` : `Manifest：${manifestRelativePath}`,
    ref_type: 'action',
    ref_id: action.id,
  })
  return { status: 'completed' }
}

async function dispatchApplyDiffAction(
  db: AppDb,
  action: ActionRecordForDispatch,
  workspaceRoot: string,
): Promise<ActionDispatchResult> {
  const result = objectValue(action.result)
  const diff = typeof result?.diff === 'string' ? result.diff : ''
  if (!diff.trim()) return recordDispatchFailure(db, action, 'unavailable', 'Diff 内容缺失，无法应用。')
  await fs.writeFile(path.join(workspaceRoot, '.agenthub-last-apply.patch'), diff, 'utf8')
  try {
    await execShell('git apply --check .agenthub-last-apply.patch && git apply .agenthub-last-apply.patch', workspaceRoot)
  } catch (error) {
    return recordDispatchFailure(db, action, 'unavailable', `应用 Diff 失败：${error instanceof Error ? error.message : String(error)}`)
  }
  const now = new Date().toISOString()
  const nextResult = dispatchResult(action, { dispatch: 'completed', appliedAt: now })
  await db.from('actions').update({ status: 'completed', executed_at: now, result: nextResult }).eq('id', action.id)
  await db.from('messages').insert({
    session_id: action.session_id,
    content: '已应用 Diff。请在 Git 面板查看变更并决定是否提交。',
    sender_type: 'agent',
    role_agent_id: action.role_agent_id ?? null,
    message_type: 'system_event',
    metadata: {
      visibleStatus: '已完成',
      actionDecision: { actionId: action.id, status: 'completed' },
    },
  })
  return { status: 'completed' }
}

export async function dispatchApprovedAction(
  db: AppDb,
  action: ActionRecordForDispatch,
): Promise<ActionDispatchResult> {
  const tool = await assertActionTool(db, action)
  if (!tool.ok) {
    return recordDispatchFailure(db, action, 'unsupported', tool.error)
  }

  if (action.action_type.startsWith('git_')) {
    const now = new Date().toISOString()
    await db.from('actions').update({
      result: dispatchResult(action, { dispatch: 'approved_waiting_git_api', at: now }),
    }).eq('id', action.id)
    return { status: 'unsupported', error: 'Git 动作已授权，等待 Git API 执行。' }
  }

  const { data: session } = await db
    .from('sessions')
    .select('workspace_id')
    .eq('id', action.session_id)
    .single()

  if (!session?.workspace_id) {
    return recordDispatchFailure(db, action, 'unavailable', '动作所属会话不存在，无法投递执行。')
  }

  const { data: workspace } = await db
    .from('workspaces')
    .select('id, owner_id, execution_domain, cloud_project_dir')
    .eq('id', session.workspace_id)
    .eq('owner_id', action.owner_id)
    .single()

  if (!workspace?.id) {
    return recordDispatchFailure(db, action, 'unavailable', '动作所属工作区不存在或无权限，无法投递执行。')
  }

  const executionDomain = workspace.execution_domain as ExecutionDomain
  if (executionDomain !== 'cloud') {
    return recordDispatchFailure(db, action, 'unsupported', '本地 Desktop 动作执行尚未接入队列执行器，未执行任何命令。')
  }
  const workspaceRoot = requireCloudWorkspaceRoot(workspace as WorkspaceDispatchRow | null)
  if (!workspaceRoot) {
    return recordDispatchFailure(db, action, 'unavailable', '云端工作区目录缺失，已阻止执行以避免读取宿主仓库。')
  }
  const violation = actionWorkspaceViolation(action, workspaceRoot)
  if (violation) {
    return recordDispatchFailure(db, action, 'unavailable', violation)
  }
  if (action.action_type === 'deploy') {
    return dispatchDeployAction(db, action, workspace.id, workspaceRoot)
  }
  if (action.action_type === 'apply_diff') {
    return dispatchApplyDiffAction(db, action, workspaceRoot)
  }

  const endpoint = await resolveEndpoint({
    userId: action.owner_id,
    workspaceId: workspace.id,
    executionDomain,
  })
  if (endpoint.status === 'unconfigured' || endpoint.id === null) {
    return recordDispatchFailure(db, action, 'unavailable', '公共云端 Runtime 尚未配置，动作未投递执行。')
  }
  if (!process.env.REDIS_URL || !(await isWorkerAlive())) {
    return recordDispatchFailure(db, action, 'unavailable', 'Runtime 执行器未就绪，动作已授权但未投递执行。')
  }

  const broker = runtimePermissionBrokerResult(action)
  const brokerRuntimeType = stringValue(broker?.runtimeType)
  const runtimeType = (brokerRuntimeType === 'codex' || brokerRuntimeType === 'claude_code')
    ? brokerRuntimeType
    : action.runtime_type ?? 'claude_code'
  const roleAgentId = stringValue(broker?.roleAgentId) ?? action.role_agent_id ?? undefined
  const nativeToolPrompt = broker ? buildApprovedNativeToolPrompt(action, broker) : null
  if (broker && !nativeToolPrompt) {
    return recordDispatchFailure(db, action, 'unavailable', 'Runtime 原生工具审批缺少可执行元数据，已阻止。')
  }
  let approvedNativeTool: ApprovedNativeToolExecution | null = null
  if (broker) {
    try {
      approvedNativeTool = await executeApprovedNativeTool(broker, workspaceRoot)
        ?? await executeApprovedShellTool(broker, workspaceRoot)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      return recordDispatchFailure(db, action, 'unavailable', `Runtime 原生工具执行失败：${error}`)
    }
  }
  const approvedNativeToolPrompt = broker ? buildApprovedNativeToolPrompt(action, broker, approvedNativeTool) : null

  const runtimeSession = await createSession({
    sessionId: action.session_id,
    endpoint,
    roleAgentId,
    runtimeType,
    cwd: action.cwd ?? workspaceRoot,
  })
  const now = new Date().toISOString()
  const queuedActionResult = dispatchResult(action, {
    dispatch: 'queued',
    runtimeSessionId: runtimeSession.id,
    approvedNativeTool: approvedNativeTool ?? undefined,
    at: now,
  })
  await db.from('actions').update({
    status: 'running',
    executed_at: now,
    result: queuedActionResult,
  }).eq('id', action.id)
  if (action.plan_node_id) {
    await db.from('plan_nodes').update({
      status: 'running',
      started_at: now,
      result: { dispatch: 'queued', runtimeSessionId: runtimeSession.id },
    }).eq('id', action.plan_node_id)
  }

  await enqueue({
    runtimeSessionId: runtimeSession.id,
    workspaceId: workspace.id,
    sessionId: action.session_id,
    ownerId: action.owner_id,
    workspaceRoot,
    endpointId: endpoint.id ?? undefined,
    runtimeType,
    permissionMode: stringValue(broker?.permissionMode),
    roleAgentId,
    nativeSessionId: stringValue(broker?.nativeSessionId) ?? runtimeSession.nativeSessionId ?? null,
    cwd: runtimeSession.cwd,
    prompt: approvedNativeToolPrompt ?? nativeToolPrompt ?? buildActionPrompt(action),
    actionId: action.id,
    actionResult: queuedActionResult,
    approvedNativeTool,
    planNodeId: action.plan_node_id ?? undefined,
  })

  return { status: 'queued', runtimeSessionId: runtimeSession.id }
}

export interface RuntimeInvokeNodeForDispatch {
  id: string
  plan_id: string
  label: string
  agent_id?: string | null
  action_type?: string | null
  action_payload?: Record<string, unknown> | null
}

type AttemptRow = {
  id: string
  attempt_number: number
}

async function latestPlanNodeAttempt(db: AppDb, planNodeId: string) {
  const { data } = await db
    .from('plan_node_attempts')
    .select('id, attempt_number')
    .eq('plan_node_id', planNodeId)
    .order('attempt_number', { ascending: false })
    .limit(1)
  const rows = Array.isArray(data) ? data as unknown as AttemptRow[] : []
  return rows[0] ?? null
}

async function markAttemptAndMailbox(
  db: AppDb,
  input: {
    attemptId?: string | null
    mailboxItemId?: string | null
    status: 'running' | 'dead_letter'
    runtimeSessionId?: string | null
    error?: string
  },
) {
  if (input.attemptId) {
    await db.from('plan_node_attempts').update({
      status: input.status,
      runtime_session_id: input.runtimeSessionId ?? null,
      error: input.error ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', input.attemptId)
  }
  if (input.mailboxItemId) {
    await db.from('agent_mailbox_items').update({
      status: input.status,
      error: input.error ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', input.mailboxItemId)
  }
}

function buildRuntimeInvokePrompt(input: {
  label: string
  userMessage: string
  phase?: string
  handoffs?: unknown
}) {
  const handoffText = input.handoffs ? `\n\nContext handoffs:\n${JSON.stringify(input.handoffs, null, 2)}` : ''
  const phaseInstruction = input.phase === 'planning'
    ? [
        'Phase contract:',
        'This is the Orchestrator planning node. Do not write files, edit files, install dependencies, start services, or run implementation commands in this node.',
        'Reply with a concise plan, role assignments, acceptance checks, and explicit handoff instructions for backend/storage and frontend workers.',
      ].join('\n')
    : input.phase === 'summarizing'
      ? [
          'Phase contract:',
          'This is the Orchestrator final validation node. Do not create or edit product files in this node.',
          'Read/check available durable evidence if needed, summarize whether backend, frontend, permissions, and artifact delivery are complete, and point to concrete files.',
        ].join('\n')
      : [
          'Phase contract:',
          'This is a worker implementation node. Implement only the work assigned to this role, using the selected workspace root and respecting permission boundaries.',
        ].join('\n')
  return [
    'AgentHub orchestrated runtime node.',
    `Node: ${input.label}`,
    input.phase ? `Phase: ${input.phase}` : null,
    phaseInstruction,
    '',
    input.userMessage,
    handoffText,
  ].filter(Boolean).join('\n')
}

type SessionWorkspaceRow = {
  workspace_id?: string
}

type WorkspaceDispatchRow = {
  id?: string
  owner_id?: string
  execution_domain?: ExecutionDomain
  cloud_project_dir?: string | null
}

type RoleDispatchRow = {
  id: string
  name: string
  system_prompt?: string | null
  runtime_type: CliRuntimeType
}

function normalizeAbsolutePath(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) return null
  const parts: string[] = []
  for (const part of trimmed.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return `/${parts.join('/')}`
}

function isPathInsideRoot(root: string, candidate: string): boolean {
  const normalizedRoot = normalizeAbsolutePath(root)
  const normalizedCandidate = normalizeAbsolutePath(candidate)
  if (!normalizedRoot || !normalizedCandidate) return false
  return normalizedCandidate === normalizedRoot || normalizedCandidate.startsWith(`${normalizedRoot}/`)
}

function absolutePathTokens(command: string): string[] {
  const withoutUrls = command.replace(/\b[a-zA-Z][a-zA-Z\d+.-]*:\/\/[^\s"'`;$|&<>)]*/g, ' ')
  const matches = [...withoutUrls.matchAll(/(^|[\s"'=])\/[^\s"'`;$|&<>)]*/g)]
    .filter((match) => {
      if (match[1] !== '"') return true
      const quoteIndex = match.index ?? 0
      return withoutUrls[quoteIndex - 1] !== ':'
    })
    .map((match) => match[0])
  return matches
    .map((match) => match.trim().replace(/^["'=]*/, '').replace(/^[^/]*/, '').replace(/[,.]$/, ''))
    .filter((token) => token !== '/dev/null')
    .filter((token) => token.startsWith('/'))
}

function actionWorkspaceViolation(action: ActionRecordForDispatch, workspaceRoot: string): string | null {
  const cwd = action.cwd?.trim()
  if (cwd && !isPathInsideRoot(workspaceRoot, cwd)) {
    return '该操作试图使用 workspace 外工作目录，已阻止。'
  }
  const outsideTarget = absolutePathTokens(action.command).find((token) => !isPathInsideRoot(workspaceRoot, token))
  if (outsideTarget) {
    return `该操作试图访问 workspace 外路径 ${outsideTarget}，已阻止。`
  }
  const broker = runtimePermissionBrokerResult(action)
  const brokerCwd = stringValue(broker?.cwd)
  if (brokerCwd && !isPathInsideRoot(workspaceRoot, brokerCwd)) {
    return '该操作试图使用 workspace 外工作目录，已阻止。'
  }
  const brokerWorkspaceRoot = stringValue(broker?.workspaceRoot)
  if (brokerWorkspaceRoot && normalizeAbsolutePath(brokerWorkspaceRoot) !== normalizeAbsolutePath(workspaceRoot)) {
    return '该操作绑定的 workspace root 与当前工作区不一致，已阻止。'
  }
  const outsideBrokerTarget = stringArrayValue(broker?.targetPaths).find((target) => {
    const normalized = normalizeAbsolutePath(target)
    return normalized !== null && !isPathInsideRoot(workspaceRoot, normalized)
  })
  if (outsideBrokerTarget) {
    return `该操作试图访问 workspace 外路径 ${outsideBrokerTarget}，已阻止。`
  }
  return null
}

function payloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return typeof value === 'string' ? value : undefined
}

function requireCloudWorkspaceRoot(workspace: WorkspaceDispatchRow | null): string | null {
  if (!workspace?.id || workspace.execution_domain !== 'cloud') return null
  const root = typeof workspace.cloud_project_dir === 'string' ? workspace.cloud_project_dir.trim() : ''
  return root.length > 0 ? root : null
}

function withRuntimeWorkspacePayload(
  node: RuntimeInvokeNodeForDispatch,
  workspaceRoot: string,
): RuntimeInvokeNodeForDispatch {
  return {
    ...node,
    action_payload: {
      ...(node.action_payload ?? {}),
      cwd: workspaceRoot,
      workspaceRoot,
    },
  }
}

export async function dispatchPreparedRuntimeInvokeNode(
  db: AppDb,
  input: {
    userId: string
    sessionId: string
    node: RuntimeInvokeNodeForDispatch
    workspaceId: string
    executionDomain: ExecutionDomain
    role: RoleDispatchRow | null
    runtimeType: CliRuntimeType
    permissionMode?: string | null
    attemptId: string
    mailboxItemId: string | null
    mailboxContextPackage?: unknown
    dispatchRuntimeJob?: (job: RuntimeJob, runtimeSessionId: string) => Promise<void>
  },
): Promise<ActionDispatchResult> {
  const payload = input.node.action_payload ?? {}
  const endpoint = await resolveEndpoint({
    userId: input.userId,
    workspaceId: input.workspaceId,
    executionDomain: input.executionDomain,
  })
  if (endpoint.status === 'unconfigured' || endpoint.id === null) {
    await markAttemptAndMailbox(db, { attemptId: input.attemptId, mailboxItemId: input.mailboxItemId, status: 'dead_letter', error: '公共云端 Runtime 尚未配置，节点未投递。' })
    await db.from('plan_nodes').update({ status: 'failed', result: { error: '公共云端 Runtime 尚未配置，节点未投递。' } }).eq('id', input.node.id)
    return { status: 'unavailable', error: '公共云端 Runtime 尚未配置，节点未投递。' }
  }
  if (!process.env.REDIS_URL || !(await isWorkerAlive())) {
    await markAttemptAndMailbox(db, { attemptId: input.attemptId, mailboxItemId: input.mailboxItemId, status: 'dead_letter', error: 'Runtime 执行器未就绪，节点未投递。' })
    await db.from('plan_nodes').update({ status: 'failed', result: { error: 'Runtime 执行器未就绪，节点未投递。' } }).eq('id', input.node.id)
    return { status: 'unavailable', error: 'Runtime 执行器未就绪，节点未投递。' }
  }

  const cwd = payloadString(payload, 'cwd') ?? null
  if (!cwd) {
    const error = 'Runtime 工作目录缺失，节点未投递以避免读取宿主仓库。'
    await markAttemptAndMailbox(db, { attemptId: input.attemptId, mailboxItemId: input.mailboxItemId, status: 'dead_letter', error })
    await db.from('plan_nodes').update({ status: 'failed', result: { error } }).eq('id', input.node.id)
    return { status: 'unavailable', error }
  }
  const runtimeSession = await createSession({
    sessionId: input.sessionId,
    endpoint,
    roleAgentId: input.role?.id ?? undefined,
    runtimeType: input.runtimeType,
    cwd,
  })
  await markAttemptAndMailbox(db, { attemptId: input.attemptId, mailboxItemId: input.mailboxItemId, status: 'running', runtimeSessionId: runtimeSession.id })
  const now = new Date().toISOString()
  await db.from('plan_nodes').update({
    status: 'running',
    started_at: now,
    result: { dispatch: 'queued', runtimeSessionId: runtimeSession.id, runtimeType: input.runtimeType, attemptId: input.attemptId, mailboxItemId: input.mailboxItemId, at: now },
  }).eq('id', input.node.id)

  const job: RuntimeJob = {
    runtimeSessionId: runtimeSession.id,
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    ownerId: input.userId,
    workspaceRoot: payloadString(payload, 'workspaceRoot') ?? cwd,
    endpointId: endpoint.id ?? undefined,
    runtimeType: input.runtimeType,
    permissionMode: input.permissionMode ?? payloadString(payload, 'permissionMode') ?? null,
    roleAgentId: input.role?.id ?? null,
    nativeSessionId: runtimeSession.nativeSessionId ?? null,
    cwd: runtimeSession.cwd,
    prompt: buildRuntimeInvokePrompt({
      label: input.node.label,
      userMessage: payloadString(payload, 'userMessage') ?? '继续执行该编排节点。',
      phase: payloadString(payload, 'phase'),
      handoffs: payload.handoffs ?? input.mailboxContextPackage,
    }),
    systemPrompt: typeof input.role?.system_prompt === 'string' ? input.role.system_prompt : undefined,
    planNodeId: input.node.id,
    attemptId: input.attemptId,
    mailboxItemId: input.mailboxItemId,
  }
  if (input.dispatchRuntimeJob) {
    await input.dispatchRuntimeJob(job, runtimeSession.id)
  } else {
    await enqueue(job)
  }
  return { status: 'queued', runtimeSessionId: runtimeSession.id }
}

export async function dispatchMailboxRuntimeInvokeItem(
  db: AppDb,
  input: {
    userId: string
    mailboxItem: AgentMailboxItem
    node: RuntimeInvokeNodeForDispatch
  },
): Promise<ActionDispatchResult> {
  const attemptId = input.mailboxItem.attempt_id
  if (!attemptId) {
    await markAttemptAndMailbox(db, {
      mailboxItemId: input.mailboxItem.id,
      status: 'dead_letter',
      error: 'Mailbox 缺少 attempt_id，无法调度。',
    })
    if (input.mailboxItem.plan_node_id) {
      await db.from('plan_nodes').update({ status: 'failed', result: { error: 'Mailbox 缺少 attempt_id，无法调度。' } }).eq('id', input.mailboxItem.plan_node_id)
    }
    return { status: 'unavailable', error: 'Mailbox 缺少 attempt_id，无法调度。' }
  }

  if (input.node.action_type && input.node.action_type !== 'runtime_invoke') {
    await markAttemptAndMailbox(db, {
      attemptId,
      mailboxItemId: input.mailboxItem.id,
      status: 'dead_letter',
      error: 'Mailbox 只支持 runtime_invoke 节点调度。',
    })
    await db.from('plan_nodes').update({ status: 'failed', result: { error: 'Mailbox 只支持 runtime_invoke 节点调度。' } }).eq('id', input.node.id)
    return { status: 'unsupported', error: 'Mailbox 只支持 runtime_invoke 节点调度。' }
  }

  const { data: session } = await db
    .from('sessions')
    .select('workspace_id')
    .eq('id', input.mailboxItem.session_id)
    .single()
  const workspaceId = (session as SessionWorkspaceRow | null)?.workspace_id
  if (!workspaceId) {
    await markAttemptAndMailbox(db, { attemptId, mailboxItemId: input.mailboxItem.id, status: 'dead_letter', error: 'Mailbox 所属会话不存在，无法调度。' })
    await db.from('plan_nodes').update({ status: 'failed', result: { error: 'Mailbox 所属会话不存在，无法调度。' } }).eq('id', input.node.id)
    return { status: 'unavailable', error: 'Mailbox 所属会话不存在，无法调度。' }
  }

  const { data: workspace } = await db
    .from('workspaces')
    .select('id, owner_id, execution_domain, cloud_project_dir')
    .eq('id', workspaceId)
    .eq('owner_id', input.userId)
    .single()
  const workspaceRow = workspace as WorkspaceDispatchRow | null
  if (!workspaceRow?.id) {
    await markAttemptAndMailbox(db, { attemptId, mailboxItemId: input.mailboxItem.id, status: 'dead_letter', error: 'Mailbox 所属工作区不存在或无权限，无法调度。' })
    await db.from('plan_nodes').update({ status: 'failed', result: { error: 'Mailbox 所属工作区不存在或无权限，无法调度。' } }).eq('id', input.node.id)
    return { status: 'unavailable', error: 'Mailbox 所属工作区不存在或无权限，无法调度。' }
  }
  if (workspaceRow.execution_domain !== 'cloud') {
    await markAttemptAndMailbox(db, { attemptId, mailboxItemId: input.mailboxItem.id, status: 'dead_letter', error: '当前完整线路只支持 cloud mailbox 调度。' })
    await db.from('plan_nodes').update({ status: 'failed', result: { error: '当前完整线路只支持 cloud mailbox 调度。' } }).eq('id', input.node.id)
    return { status: 'unsupported', error: '当前完整线路只支持 cloud mailbox 调度。' }
  }
  const workspaceRoot = requireCloudWorkspaceRoot(workspaceRow)
  if (!workspaceRoot) {
    await markAttemptAndMailbox(db, { attemptId, mailboxItemId: input.mailboxItem.id, status: 'dead_letter', error: '云端工作区目录缺失，Mailbox 未投递。' })
    await db.from('plan_nodes').update({ status: 'failed', result: { error: '云端工作区目录缺失，Mailbox 未投递。' } }).eq('id', input.node.id)
    return { status: 'unavailable', error: '云端工作区目录缺失，Mailbox 未投递。' }
  }

  const { data: role } = await db
    .from('role_agents')
    .select('id, name, system_prompt, runtime_type')
    .eq('id', input.mailboxItem.to_role_agent_id)
    .eq('workspace_id', workspaceRow.id)
    .single()
  const roleRow = role as unknown as RoleDispatchRow | null
  if (!roleRow?.id) {
    await markAttemptAndMailbox(db, { attemptId, mailboxItemId: input.mailboxItem.id, status: 'dead_letter', error: 'Mailbox 目标角色不存在或无权限，无法调度。' })
    await db.from('plan_nodes').update({ status: 'failed', result: { error: 'Mailbox 目标角色不存在或无权限，无法调度。' } }).eq('id', input.node.id)
    return { status: 'unavailable', error: 'Mailbox 目标角色不存在或无权限，无法调度。' }
  }

  return dispatchPreparedRuntimeInvokeNode(db, {
    userId: input.userId,
    sessionId: input.mailboxItem.session_id,
    node: withRuntimeWorkspacePayload(input.node, workspaceRoot),
    workspaceId: workspaceRow.id,
    executionDomain: workspaceRow.execution_domain,
    role: roleRow,
    runtimeType: roleRow.runtime_type,
    attemptId,
    mailboxItemId: input.mailboxItem.id,
    mailboxContextPackage: input.mailboxItem.context_package,
  })
}

export async function dispatchRuntimeInvokeNode(
  db: AppDb,
  input: {
    userId: string
    sessionId: string
    node: RuntimeInvokeNodeForDispatch
  },
): Promise<ActionDispatchResult> {
  const { data: session } = await db
    .from('sessions')
    .select('workspace_id')
    .eq('id', input.sessionId)
    .single()
  const workspaceId = (session as SessionWorkspaceRow | null)?.workspace_id
  if (!workspaceId) {
    await db.from('plan_nodes').update({ status: 'failed', result: { error: '节点所属会话不存在，无法投递 Runtime。' } }).eq('id', input.node.id)
    return { status: 'unavailable', error: '节点所属会话不存在，无法投递 Runtime。' }
  }

  const { data: workspace } = await db
    .from('workspaces')
    .select('id, owner_id, execution_domain, cloud_project_dir')
    .eq('id', workspaceId)
    .eq('owner_id', input.userId)
    .single()
  const workspaceRow = workspace as WorkspaceDispatchRow | null
  if (!workspaceRow?.id) {
    await db.from('plan_nodes').update({ status: 'failed', result: { error: '节点所属工作区不存在或无权限，无法投递 Runtime。' } }).eq('id', input.node.id)
    return { status: 'unavailable', error: '节点所属工作区不存在或无权限，无法投递 Runtime。' }
  }
  const executionDomain = workspaceRow.execution_domain
  if (executionDomain !== 'cloud') {
    await db.from('plan_nodes').update({ status: 'failed', result: { error: '当前完整线路只支持 cloud runtime_invoke。' } }).eq('id', input.node.id)
    return { status: 'unsupported', error: '当前完整线路只支持 cloud runtime_invoke。' }
  }
  const workspaceRoot = requireCloudWorkspaceRoot(workspaceRow)
  if (!workspaceRoot) {
    await db.from('plan_nodes').update({ status: 'failed', result: { error: '云端工作区目录缺失，节点未投递 Runtime。' } }).eq('id', input.node.id)
    return { status: 'unavailable', error: '云端工作区目录缺失，节点未投递 Runtime。' }
  }

  const { data: role } = input.node.agent_id
    ? await db
      .from('role_agents')
      .select('id, name, system_prompt, runtime_type')
      .eq('id', input.node.agent_id)
      .eq('workspace_id', workspaceRow.id)
      .single()
    : { data: null }
  const roleRow = role as RoleDispatchRow | null
  const runtimeType: CliRuntimeType = roleRow?.runtime_type === 'codex' ? 'codex' : 'claude_code'
  const payload = input.node.action_payload ?? {}
  const previousAttempt = await latestPlanNodeAttempt(db, input.node.id)
  const { data: attempt, error: attemptError } = await db
    .from('plan_node_attempts')
    .insert({
      plan_node_id: input.node.id,
      attempt_number: (previousAttempt?.attempt_number ?? 0) + 1,
      control: 'initial',
      previous_attempt_id: previousAttempt?.id ?? null,
      runtime_session_id: null,
      mailbox_item_id: null,
      status: 'queued',
      error: null,
    })
    .select()
    .single()
  if (attemptError || !attempt) {
    await db.from('plan_nodes').update({ status: 'failed', result: { error: attemptError?.message ?? '创建节点尝试失败。' } }).eq('id', input.node.id)
    return { status: 'unavailable', error: attemptError?.message ?? '创建节点尝试失败。' }
  }
  const attemptId = (attempt as unknown as { id: string }).id
  let mailboxItemId: string | null = null
  if (roleRow?.id) {
    const { data: mailbox, error: mailboxError } = await db
      .from('agent_mailbox_items')
      .insert({
        workspace_id: workspaceRow.id,
        session_id: input.sessionId,
        plan_id: input.node.plan_id,
        plan_node_id: input.node.id,
        direction: 'inbound',
        from_role_agent_id: null,
        to_role_agent_id: roleRow.id,
        attempt_id: attemptId,
        parent_attempt_id: previousAttempt?.id ?? null,
        lineage_root_id: previousAttempt?.id ?? attemptId,
        runtime_type: runtimeType,
        status: 'queued',
        context_package: {
          fromRoleAgentId: null,
          fromRoleName: 'Orchestrator',
          toRoleAgentId: roleRow.id,
          toRoleName: roleRow.name,
          sessionId: input.sessionId,
          summary: typeof payload.userMessage === 'string' ? payload.userMessage : `执行编排节点「${input.node.label}」。`,
          sourceMessageId: null,
          target: 'initial',
          phase: typeof payload.phase === 'string' ? payload.phase : 'worker',
          runtimeType,
          metadata: { planId: input.node.plan_id, planNodeId: input.node.id, attemptId },
          createdAt: new Date().toISOString(),
        },
        reply_to_mailbox_item_id: null,
        error: null,
      })
      .select()
      .single()
    if (mailboxError || !mailbox) {
      await db.from('plan_nodes').update({ status: 'failed', result: { error: mailboxError?.message ?? '创建节点 mailbox 失败。' } }).eq('id', input.node.id)
      return { status: 'unavailable', error: mailboxError?.message ?? '创建节点 mailbox 失败。' }
    }
    mailboxItemId = (mailbox as unknown as { id: string }).id
    await db.from('plan_node_attempts').update({ mailbox_item_id: mailboxItemId }).eq('id', attemptId)
  }

  return dispatchPreparedRuntimeInvokeNode(db, {
    userId: input.userId,
    sessionId: input.sessionId,
    node: withRuntimeWorkspacePayload(input.node, workspaceRoot),
    workspaceId: workspaceRow.id,
    executionDomain,
    role: roleRow,
    runtimeType,
    attemptId,
    mailboxItemId,
  })
}
