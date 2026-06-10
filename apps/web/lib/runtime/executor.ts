import { spawn, spawnSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { redactString } from './redact'
import { NativeCliToolActionKind, type NativeCliToolActionKind as NativeCliToolActionKindType } from '@agenthub/shared'

export interface NativeCliToolRequest {
  id?: string
  toolName: string
  actionKind: NativeCliToolActionKindType
  cwd?: string
  targetPaths?: string[]
  commandPreview?: string
  input?: unknown
}

export interface NativeCliQuestionRequest {
  id?: string
  toolName: string
  questionId?: string
  title?: string
  content: string
  input?: unknown
}

export interface NativeCliObservedAction {
  id?: string
  toolName: string
  actionKind: NativeCliToolActionKindType
  status: 'running' | 'completed' | 'failed'
  cwd?: string
  targetPaths?: string[]
  commandPreview?: string
  output?: string
  exitCode?: number | null
  input?: unknown
}

export interface ExecutorChunk {
  delta?: string
  nativeSessionId?: string
  toolRequest?: NativeCliToolRequest
  question?: NativeCliQuestionRequest
  observedAction?: NativeCliObservedAction
}

export interface ExecutorJob {
  prompt: string
  fail?: boolean
  nativeSessionId?: string | null
  permissionMode?: string | null
}

export interface RuntimeExecutor {
  execute(job: ExecutorJob): AsyncIterable<ExecutorChunk>
}

export interface CliRuntimeCapability {
  type: CliRuntimeType
  available: boolean
  authenticated: boolean
  launchable: boolean
  supportsResume: boolean
  supportsContinue: boolean
  version?: string
  cliPath?: string
  diagnostic?: string
}

// Thrown when the real CLI binary is missing or cannot be spawned. The worker maps this to a
// runtime_failed event instead of pretending the job succeeded.
export class ExecutorUnavailableError extends Error {
  readonly code = 'executor_unavailable'
  constructor(message: string) {
    super(message)
    this.name = 'ExecutorUnavailableError'
  }
}

export type CliRuntimeType = 'claude_code' | 'codex'

export interface CliExecutorOptions {
  runtimeType: CliRuntimeType
  cwd?: string
  // Credentials are injected here into the child process env only — never echoed into chunks/logs.
  env?: Record<string, string>
}

const CLI_BINARY: Record<CliRuntimeType, string> = { claude_code: 'claude', codex: 'codex' }

function runProbe(command: string, args: string[], timeout = 5000) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout,
    env: process.env,
  })
  return {
    ok: result.status === 0,
    stdout: typeof result.stdout === 'string' ? result.stdout.trim() : '',
    stderr: typeof result.stderr === 'string' ? result.stderr.trim() : '',
    error: result.error?.message,
  }
}

function resolveCommandPath(binary: string) {
  const result = runProbe('sh', ['-lc', `command -v ${binary} || true`], 3000)
  return result.stdout.split(/\r?\n/).find(Boolean) ?? null
}

export function detectCliRuntimeCapabilities(): CliRuntimeCapability[] {
  const claudePath = resolveCommandPath('claude')
  const codexPath = resolveCommandPath('codex')
  const claudeVersion = claudePath ? runProbe(claudePath, ['--version']).stdout : ''
  const codexVersion = codexPath ? runProbe(codexPath, ['--version']).stdout : ''
  const claudeAuth = claudePath ? runProbe(claudePath, ['auth', 'status', '--json'], 8000) : null
  const codexAuth = codexPath ? runProbe(codexPath, ['login', 'status'], 8000) : null

  return [
    {
      type: 'claude_code',
      available: Boolean(claudePath),
      authenticated: Boolean(claudePath && claudeAuth?.ok),
      launchable: Boolean(claudePath && claudeAuth?.ok),
      supportsResume: true,
      supportsContinue: true,
      version: claudeVersion || undefined,
      cliPath: claudePath ?? undefined,
      diagnostic: claudePath ? (claudeAuth?.ok ? 'authenticated' : claudeAuth?.stderr || claudeAuth?.stdout || claudeAuth?.error || 'auth status failed') : 'claude CLI not found',
    },
    {
      type: 'codex',
      available: Boolean(codexPath),
      authenticated: Boolean(codexPath && codexAuth?.ok),
      launchable: Boolean(codexPath && codexAuth?.ok),
      supportsResume: true,
      supportsContinue: true,
      version: codexVersion || undefined,
      cliPath: codexPath ?? undefined,
      diagnostic: codexPath ? (codexAuth?.ok ? 'authenticated' : codexAuth?.stderr || codexAuth?.stdout || codexAuth?.error || 'login status failed') : 'codex CLI not found',
    },
  ]
}

function codexApprovalArgs(permissionMode?: string | null) {
  if (permissionMode === 'full_control' || permissionMode === 'dangerous_bypass') return ['-a', 'never']
  return ['-a', 'on-request']
}

function codexSandboxMode(permissionMode?: string | null) {
  if (permissionMode === 'full_control' || permissionMode === 'dangerous_bypass') return 'workspace-write'
  return 'read-only'
}

function claudePermissionArgs(permissionMode?: string | null) {
  if (permissionMode === 'full_control') return ['--permission-mode', 'bypassPermissions']
  if (permissionMode === 'dangerous_bypass') return ['--dangerously-skip-permissions']
  return ['--permission-mode', 'default']
}

export function cliArgs(runtimeType: CliRuntimeType, prompt: string, nativeSessionId?: string | null, cwd?: string, permissionMode?: string | null) {
  if (runtimeType === 'codex') {
    const approvalArgs = codexApprovalArgs(permissionMode)
    if (nativeSessionId) {
      return [...approvalArgs, 'exec', 'resume', '--json', '--skip-git-repo-check', nativeSessionId, prompt]
    }
    return [
      ...approvalArgs,
      'exec',
      '--json',
      '-s',
      codexSandboxMode(permissionMode),
      '--skip-git-repo-check',
      '--color',
      'never',
      ...(cwd ? ['-C', cwd] : []),
      prompt,
    ]
  }
  const permissionArgs = claudePermissionArgs(permissionMode)
  if (nativeSessionId) {
    return ['--print', '--verbose', '--output-format', 'stream-json', '--include-partial-messages', ...permissionArgs, '--resume', nativeSessionId, prompt]
  }
  return ['--print', '--verbose', '--output-format', 'stream-json', '--include-partial-messages', ...permissionArgs, prompt]
}

function nativeSessionIdFromRecord(record: Record<string, unknown>) {
  const sessionId = record.session_id ?? record.sessionId ?? record.thread_id ?? record.threadId ?? record.conversation_id ?? record.conversationId
  return typeof sessionId === 'string' && sessionId ? sessionId : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord).filter((item): item is Record<string, unknown> => Boolean(item)) : []
}

function stringValue(record: Record<string, unknown> | null | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value.join(' ').trim()
  }
  return undefined
}

function collectPathValues(value: unknown, paths: string[]) {
  if (typeof value === 'string' && value.trim()) {
    paths.push(value.trim())
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPathValues(item, paths)
  }
}

function pathsFromInput(input: Record<string, unknown> | null): string[] {
  if (!input) return []
  const paths: string[] = []
  for (const key of ['path', 'file_path', 'filepath', 'target_path', 'targetPath', 'target', 'paths', 'files']) {
    collectPathValues(input[key], paths)
  }
  return [...new Set(paths)]
}

function shellActionKind(command: string): NativeCliToolActionKindType {
  const normalized = command.toLowerCase()
  if (/\brm\s+-[^\n;|&]*r|git\s+reset\s+--hard|git\s+clean\s+-[^\n;|&]*f|drop\s+(table|database)|delete\s+from/.test(normalized)) {
    return NativeCliToolActionKind.DestructiveCommand
  }
  if (/\b(npm|pnpm|yarn|bun|pip|uv|cargo|go)\s+(install|add|get)\b/.test(normalized)) {
    return NativeCliToolActionKind.InstallDependency
  }
  if (/\b(npm|pnpm|yarn|bun)\s+(run\s+)?(dev|start|serve)\b|\b(vite|next|astro)\s+(dev|start)\b/.test(normalized)) {
    return NativeCliToolActionKind.StartService
  }
  if (/\b(curl|wget)\b|https?:\/\//.test(normalized)) {
    return NativeCliToolActionKind.NetworkRequest
  }
  return NativeCliToolActionKind.ShellCommand
}

function actionKindForTool(toolName: string, input: Record<string, unknown> | null, commandPreview?: string): NativeCliToolActionKindType {
  const name = toolName.toLowerCase()
  if (commandPreview) return shellActionKind(commandPreview)
  if (name.includes('write') || name.includes('edit') || name.includes('patch') || name.includes('create')) {
    return NativeCliToolActionKind.WriteFile
  }
  if (name.includes('fetch') || name.includes('web') || name.includes('http')) {
    return NativeCliToolActionKind.NetworkRequest
  }
  if (name.includes('read') || name.includes('view') || name.includes('open') || name === 'glob' || name === 'grep' || name === 'ls' || name === 'list') {
    return NativeCliToolActionKind.ReadFile
  }
  if (pathsFromInput(input).length > 0) return NativeCliToolActionKind.ReadFile
  return NativeCliToolActionKind.ShellCommand
}

function isToolCallBlock(block: Record<string, unknown>): boolean {
  return block.type === 'tool_use' || block.type === 'tool_call' || block.type === 'function_call' || block.type === 'exec_command'
}

function isAskUserQuestionToolName(toolName: string): boolean {
  return toolName.replace(/[^a-z0-9]/gi, '').toLowerCase() === 'askuserquestion'
}

function isNonExecutableRuntimeToolName(toolName: string): boolean {
  const normalized = toolName.replace(/[^a-z0-9]/gi, '').toLowerCase()
  return normalized === 'taskcreate' || normalized === 'taskupdate' || normalized === 'todowrite' || normalized === 'agent'
}

function inputForToolBlock(block: Record<string, unknown>): unknown {
  return asRecord(block.input) ?? asRecord(block.arguments) ?? asRecord(block.args) ?? block.input ?? block.arguments
}

function toolNameForBlock(block: Record<string, unknown>): string {
  return stringValue(block, ['name', 'toolName', 'tool_name', 'functionName', 'function_name'])
    ?? stringValue(asRecord(block.function), ['name'])
    ?? (block.type === 'exec_command' ? 'exec_command' : 'tool')
}

function toolRequestFromBlock(block: Record<string, unknown>): NativeCliToolRequest | null {
  if (!isToolCallBlock(block)) return null
  const input = asRecord(block.input) ?? asRecord(block.arguments) ?? asRecord(block.args)
  const toolName = toolNameForBlock(block)
  if (isAskUserQuestionToolName(toolName)) return null
  if (isNonExecutableRuntimeToolName(toolName)) return null
  const commandPreview = stringValue(input, ['command', 'cmd', 'shell_command', 'shellCommand'])
  return {
    id: stringValue(block, ['id', 'toolCallId', 'tool_call_id', 'callId']),
    toolName,
    input: input ?? block.input ?? block.arguments,
    actionKind: actionKindForTool(toolName, input, commandPreview),
    cwd: stringValue(input, ['cwd', 'working_directory', 'workingDirectory']),
    targetPaths: pathsFromInput(input),
    commandPreview,
  }
}

function questionLineFromRecord(record: Record<string, unknown>, index: number): string {
  const header = stringValue(record, ['header', 'title', 'label'])
  const question = stringValue(record, ['question', 'content', 'message', 'text', 'prompt'])
  const multiSelect = record.multiSelect === true || record.multi_select === true ? '（可多选）' : ''
  const headline = [header, question].filter(Boolean).join(header && question ? '：' : '')
  const prefix = index > 0 ? `${index + 1}. ` : ''
  const lines = [`${prefix}${headline || '请补充确认信息'}${multiSelect}`]
  const options = asRecordArray(record.options)
  for (const option of options) {
    const optionLabel = stringValue(option, ['label', 'value', 'text', 'title'])
    const optionDescription = stringValue(option, ['description', 'detail', 'content'])
    if (optionLabel) {
      lines.push(`- ${optionLabel}${optionDescription ? `：${optionDescription}` : ''}`)
    }
  }
  return lines.join('\n')
}

function questionContentFromInput(input: unknown): string {
  const record = asRecord(input)
  if (!record) {
    return typeof input === 'string' && input.trim() ? input.trim() : 'Runtime 请求用户补充确认。'
  }
  const questions = asRecordArray(record.questions)
  if (questions.length > 0) {
    return questions.map(questionLineFromRecord).join('\n\n')
  }
  const direct = stringValue(record, ['question', 'content', 'message', 'text', 'prompt'])
  if (direct) return direct
  try {
    return JSON.stringify(record)
  } catch {
    return 'Runtime 请求用户补充确认。'
  }
}

function questionTitleFromInput(input: unknown): string | undefined {
  const record = asRecord(input)
  if (!record) return undefined
  const direct = stringValue(record, ['title', 'header'])
  if (direct) return direct
  const firstQuestion = asRecordArray(record.questions)[0]
  return stringValue(firstQuestion, ['header', 'title'])
}

function questionRequestFromBlock(block: Record<string, unknown>): NativeCliQuestionRequest | null {
  if (!isToolCallBlock(block)) return null
  const toolName = toolNameForBlock(block)
  if (!isAskUserQuestionToolName(toolName)) return null
  const input = inputForToolBlock(block)
  const id = stringValue(block, ['id', 'toolCallId', 'tool_call_id', 'callId'])
  return {
    id,
    toolName,
    questionId: id,
    title: questionTitleFromInput(input) ?? '需要用户确认',
    content: questionContentFromInput(input),
    input,
  }
}

function toolRequestsFromRecord(record: Record<string, unknown>): NativeCliToolRequest[] {
  const candidates: Record<string, unknown>[] = []
  const nestedEvent = asRecord(record.event)
  const params = asRecord(record.params)
  const payload = asRecord(record.payload)
  candidates.push(
    ...[record, nestedEvent, params, payload, asRecord(record.item), asRecord(params?.item), asRecord(payload?.item), asRecord(record.content_block), asRecord(nestedEvent?.content_block)]
      .filter((item): item is Record<string, unknown> => Boolean(item)),
  )
  for (const source of [record.content, asRecord(record.message)?.content, payload?.content]) {
    candidates.push(...asRecordArray(source))
  }
  return candidates.map(toolRequestFromBlock).filter((item): item is NativeCliToolRequest => Boolean(item))
}

function questionRequestsFromRecord(record: Record<string, unknown>): NativeCliQuestionRequest[] {
  const candidates: Record<string, unknown>[] = []
  const nestedEvent = asRecord(record.event)
  const params = asRecord(record.params)
  const payload = asRecord(record.payload)
  candidates.push(
    ...[record, nestedEvent, params, payload, asRecord(record.item), asRecord(params?.item), asRecord(payload?.item), asRecord(record.content_block), asRecord(nestedEvent?.content_block)]
      .filter((item): item is Record<string, unknown> => Boolean(item)),
  )
  for (const source of [record.content, asRecord(record.message)?.content, payload?.content]) {
    candidates.push(...asRecordArray(source))
  }
  return candidates.map(questionRequestFromBlock).filter((item): item is NativeCliQuestionRequest => Boolean(item))
}

function recordType(record: Record<string, unknown>): string | null {
  return typeof record.type === 'string' ? record.type : null
}

function claudeStreamEvent(record: Record<string, unknown>): Record<string, unknown> {
  return asRecord(record.event) ?? record
}

function claudeStartedToolBlock(record: Record<string, unknown>): Record<string, unknown> | null {
  const event = claudeStreamEvent(record)
  if (recordType(event) !== 'content_block_start') return null
  return asRecord(event.content_block)
}

function claudeInputJsonDelta(record: Record<string, unknown>): string | null {
  const event = claudeStreamEvent(record)
  if (recordType(event) !== 'content_block_delta') return null
  const delta = asRecord(event.delta)
  return delta?.type === 'input_json_delta' && typeof delta.partial_json === 'string'
    ? delta.partial_json
    : null
}

function isClaudeContentBlockStop(record: Record<string, unknown>): boolean {
  return recordType(claudeStreamEvent(record)) === 'content_block_stop'
}

function textFromClaudeDelta(record: Record<string, unknown>) {
  const nestedEvent = asRecord(record.event)
  const nestedDelta = asRecord(nestedEvent?.delta)
  const directDelta = asRecord(record.delta)
  if (typeof record.delta === 'string') return record.delta
  if (nestedEvent?.type === 'content_block_delta' && typeof nestedDelta?.text === 'string') return nestedDelta.text
  if (record.type === 'content_block_delta' && typeof directDelta?.text === 'string') return directDelta.text
  return null
}

function textFromClaudeFinal(record: Record<string, unknown>) {
  return typeof record.result === 'string' ? record.result : null
}

function textFromCodexDelta(record: Record<string, unknown>) {
  const params = asRecord(record.params)
  const item = asRecord(record.item) ?? asRecord(params?.item)
  if (
    (record.type === 'item.delta' || record.type === 'item.agent_message.delta' || record.method === 'item/agentMessage/delta') &&
    typeof (params?.delta ?? record.delta) === 'string'
  ) {
    return String(params?.delta ?? record.delta)
  }
  if (
    record.type === 'event_msg' &&
    asRecord(record.payload)?.type === 'agent_message_delta' &&
    typeof asRecord(record.payload)?.delta === 'string'
  ) {
    return String(asRecord(record.payload)?.delta)
  }
  if (item?.type === 'agent_message' && typeof record.delta === 'string') return record.delta
  return null
}

function textFromCodexFinal(record: Record<string, unknown>) {
  const payload = asRecord(record.payload)
  if (record.type === 'event_msg' && payload?.type === 'agent_message') {
    return payload.phase === 'final_answer' && typeof payload.message === 'string' ? payload.message : null
  }
  if (record.type === 'event_msg' && payload?.type === 'task_complete') {
    return typeof payload.last_agent_message === 'string' ? payload.last_agent_message : null
  }

  const params = asRecord(record.params)
  const item = asRecord(record.item) ?? asRecord(params?.item)
  if (record.type !== 'item.completed' && record.method !== 'item/completed') return null
  if (item?.type !== 'agent_message') return null
  const phase = item.phase ?? item.role ?? item.channel
  if (phase && phase !== 'final_answer' && phase !== 'assistant') return null
  return typeof item.text === 'string' ? item.text : typeof item.message === 'string' ? item.message : null
}

function observedActionFromCodexRecord(record: Record<string, unknown>): NativeCliObservedAction | null {
  if (record.type !== 'item.started' && record.type !== 'item.completed') return null
  const item = asRecord(record.item) ?? asRecord(asRecord(record.params)?.item)
  if (!item) return null
  const id = stringValue(item, ['id'])
  if (item.type === 'command_execution') {
    const command = stringValue(item, ['command'])
    if (!command) return null
    const exitCode = typeof item.exit_code === 'number' ? item.exit_code : null
    const status = record.type === 'item.completed'
      ? (exitCode === 0 ? 'completed' : 'failed')
      : 'running'
    return {
      id,
      toolName: 'command_execution',
      actionKind: shellActionKind(command),
      status,
      commandPreview: command,
      output: stringValue(item, ['aggregated_output']),
      exitCode,
      input: item,
    }
  }
  if (item.type === 'file_change') {
    const changes = asRecordArray(item.changes)
    const targetPaths = changes
      .map((change) => stringValue(change, ['path']))
      .filter((target): target is string => Boolean(target))
    return {
      id,
      toolName: 'file_change',
      actionKind: NativeCliToolActionKind.WriteFile,
      status: record.type === 'item.completed' ? 'completed' : 'running',
      targetPaths,
      input: item,
    }
  }
  return null
}

export class CliOutputParser {
  private sawDelta = false
  private pendingClaudeTool: { block: Record<string, unknown>; inputJson: string } | null = null

  constructor(private readonly runtimeType: CliRuntimeType) {}

  parseLine(line: string): ExecutorChunk[] {
    if (this.runtimeType !== 'codex') {
      return this.parseClaudeLine(line)
    }
    return this.parseCodexLine(line)
  }

  private parseClaudeLine(line: string): ExecutorChunk[] {
    try {
      const record = JSON.parse(line) as Record<string, unknown>
      const nativeSessionId = nativeSessionIdFromRecord(record)
      const startedTool = claudeStartedToolBlock(record)
      if (startedTool) {
        const question = questionRequestFromBlock(startedTool)
        if (question && question.input && asRecord(question.input) && Object.keys(asRecord(question.input) ?? {}).length > 0) {
          return [
            ...(nativeSessionId ? [{ nativeSessionId }] : []),
            { question },
          ]
        }
        const request = toolRequestFromBlock(startedTool)
        const input = asRecord(request?.input)
        if (request && input && Object.keys(input).length > 0) {
          return [
            ...(nativeSessionId ? [{ nativeSessionId }] : []),
            { toolRequest: request },
          ]
        }
        this.pendingClaudeTool = { block: startedTool, inputJson: '' }
        return [
          ...(nativeSessionId ? [{ nativeSessionId }] : []),
        ]
      }
      const inputDelta = claudeInputJsonDelta(record)
      if (inputDelta !== null && this.pendingClaudeTool) {
        this.pendingClaudeTool.inputJson += inputDelta
        return [
          ...(nativeSessionId ? [{ nativeSessionId }] : []),
        ]
      }
      if (isClaudeContentBlockStop(record) && this.pendingClaudeTool) {
        const pending = this.pendingClaudeTool
        this.pendingClaudeTool = null
        let input: unknown = pending.block.input
        if (pending.inputJson.trim()) {
          try {
            input = JSON.parse(pending.inputJson)
          } catch {
            input = pending.inputJson
          }
        }
        const request = toolRequestFromBlock({ ...pending.block, input })
        const question = questionRequestFromBlock({ ...pending.block, input })
        return [
          ...(nativeSessionId ? [{ nativeSessionId }] : []),
          ...(question ? [{ question }] : []),
          ...(request ? [{ toolRequest: request }] : []),
        ]
      }
      const questions = questionRequestsFromRecord(record)
      if (questions.length > 0) {
        return [
          ...(nativeSessionId ? [{ nativeSessionId }] : []),
          ...questions.map((question) => ({ question })),
        ]
      }
      const toolRequests = toolRequestsFromRecord(record)
      if (toolRequests.length > 0) {
        return [
          ...(nativeSessionId ? [{ nativeSessionId }] : []),
          ...toolRequests.map((toolRequest) => ({ toolRequest })),
        ]
      }
      const delta = textFromClaudeDelta(record)
      if (delta) {
        this.sawDelta = true
        return [
          ...(nativeSessionId ? [{ nativeSessionId }] : []),
          { delta },
        ]
      }
      const finalText = textFromClaudeFinal(record)
      if (finalText && !this.sawDelta) {
        this.sawDelta = true
        return [
          ...(nativeSessionId ? [{ nativeSessionId }] : []),
          { delta: finalText },
        ]
      }
      return [
        ...(nativeSessionId ? [{ nativeSessionId }] : []),
      ]
    } catch {
      return [{ delta: line + '\n' }]
    }
  }

  private parseCodexLine(line: string): ExecutorChunk[] {
    try {
      const record = JSON.parse(line) as Record<string, unknown>
      const item = asRecord(record.item) ?? asRecord(asRecord(record.params)?.item)
      const nativeSessionId = nativeSessionIdFromRecord(record)
        ?? (item ? nativeSessionIdFromRecord(item) : null)
      const questions = questionRequestsFromRecord(record)
      if (questions.length > 0) {
        return [
          ...(nativeSessionId ? [{ nativeSessionId }] : []),
          ...questions.map((question) => ({ question })),
        ]
      }
      const toolRequests = toolRequestsFromRecord(record)
      if (toolRequests.length > 0) {
        return [
          ...(nativeSessionId ? [{ nativeSessionId }] : []),
          ...toolRequests.map((toolRequest) => ({ toolRequest })),
        ]
      }
      const observedAction = observedActionFromCodexRecord(record)
      if (observedAction) {
        return [
          ...(nativeSessionId ? [{ nativeSessionId }] : []),
          { observedAction },
        ]
      }
      const delta = textFromCodexDelta(record)
      if (delta) {
        this.sawDelta = true
        return [
          ...(nativeSessionId ? [{ nativeSessionId }] : []),
          { delta },
        ]
      }
      const finalText = textFromCodexFinal(record)
      if (finalText && !this.sawDelta) {
        this.sawDelta = true
        return [
          ...(nativeSessionId ? [{ nativeSessionId }] : []),
          { delta: finalText },
        ]
      }
      return [
        ...(nativeSessionId ? [{ nativeSessionId }] : []),
      ]
    } catch {
      return line.trim() ? [{ delta: `${line}\n` }] : []
    }
  }
}

export function outputChunks(runtimeType: CliRuntimeType, line: string): ExecutorChunk[] {
  return new CliOutputParser(runtimeType).parseLine(line)
}

// CliRuntimeExecutor: spawns the real claude/codex CLI and streams stdout lines as chunks.
// stderr is consumed for failure diagnosis only and is NOT forwarded as output (avoids leaking
// credential-bearing error text). A missing binary (ENOENT) surfaces as ExecutorUnavailableError.
export class CliRuntimeExecutor implements RuntimeExecutor {
  constructor(private readonly options: CliExecutorOptions) {}

  async *execute(job: ExecutorJob): AsyncIterable<ExecutorChunk> {
    const binary = CLI_BINARY[this.options.runtimeType]
    const child = spawn(binary, cliArgs(this.options.runtimeType, job.prompt, job.nativeSessionId, this.options.cwd, job.permissionMode), {
      cwd: this.options.cwd,
      env: { ...process.env, ...this.options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const queue: ExecutorChunk[] = []
    let spawnError: ExecutorUnavailableError | null = null
    let exitError: Error | null = null
    let stderrTail = ''
    let done = false
    let notify: (() => void) | null = null
    const wake = () => { notify?.(); notify = null }

    child.on('error', (err: NodeJS.ErrnoException) => {
      spawnError = new ExecutorUnavailableError(
        err.code === 'ENOENT' ? `runtime CLI '${binary}' not found` : `failed to spawn '${binary}'`,
      )
      done = true
      wake()
    })

    const outputParser = new CliOutputParser(this.options.runtimeType)
    const rl = createInterface({ input: child.stdout })
    rl.on('line', (line) => {
      queue.push(...outputParser.parseLine(line))
      wake()
    })

    // Drain stderr so a chatty CLI can't fill the pipe buffer and block. Keep a short redacted
    // diagnostic tail for failed real UAT runs, but never forward stderr as model output.
    child.stderr?.on('data', (chunk) => {
      stderrTail = `${stderrTail}${chunk.toString()}`
      if (stderrTail.length > 4000) stderrTail = stderrTail.slice(-4000)
    })

    child.on('close', (code) => {
      if (code !== 0 && !spawnError) {
        const detail = redactString(stderrTail).trim().split(/\r?\n/).slice(-8).join('\n')
        exitError = new Error([
          `runtime CLI exited with code ${code ?? 'null'}`,
          detail ? `stderr:\n${detail}` : null,
        ].filter(Boolean).join('\n'))
      }
      done = true
      wake()
    })

    try {
      while (true) {
        if (spawnError) throw spawnError
        while (queue.length > 0) yield queue.shift()!
        if (done) break
        await new Promise<void>((resolve) => { notify = resolve })
      }
    } finally {
      if (!done && !child.killed) {
        child.kill('SIGTERM')
      }
      rl.close()
    }
    if (spawnError) throw spawnError
    if (exitError) throw exitError
  }
}

// FakeExecutor: echoes the prompt as space-delimited streamed chunks. No paid API, no real CLI spawn.
// job.fail injects a mid-stream failure to exercise the failure path.
export class FakeExecutor implements RuntimeExecutor {
  async *execute(job: ExecutorJob): AsyncIterable<ExecutorChunk> {
    const words = job.prompt.trim().split(/\s+/).filter(Boolean)
    const tokens = words.length > 0 ? words : ['echo']
    for (let i = 0; i < tokens.length; i++) {
      if (job.fail && i === Math.floor(tokens.length / 2)) {
        throw new Error('FakeExecutor injected failure')
      }
      yield { delta: i === 0 ? tokens[i] : ` ${tokens[i]}` }
    }
  }
}

// ScriptedRealExecutor: streams a fixed, recognizable reply that does NOT echo the prompt. Unlike
// FakeExecutor (which echoes input), this stands in for a real executor's produced output — used to
// validate the full enqueue→worker→DB delivery path with a deterministic, non-echo reply where a
// paid CLI isn't desirable. The reply is configurable via RUNTIME_SCRIPT_REPLY.
export class ScriptedRealExecutor implements RuntimeExecutor {
  async *execute(job: ExecutorJob): AsyncIterable<ExecutorChunk> {
    const reply = process.env.RUNTIME_SCRIPT_REPLY ?? '已收到你的请求，这是运行时执行器返回的回复。'
    const segments = reply.match(/.{1,8}/gu) ?? [reply]
    for (let i = 0; i < segments.length; i++) {
      if (job.fail && i === Math.floor(segments.length / 2)) {
        throw new Error('ScriptedRealExecutor injected failure')
      }
      yield { delta: segments[i] }
    }
  }
}
