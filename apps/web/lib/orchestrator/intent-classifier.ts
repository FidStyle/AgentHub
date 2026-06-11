import { spawn, spawnSync } from 'node:child_process'

// Keyword fallback used when the CLI judge is unavailable or times out. Intentionally
// broader than a single regex: covers explicit delivery wording, the canonical demo
// prompt, generation verbs paired with deliverable nouns, file extensions, and any
// direct mention of "产物". Kept in sync with the LLM prompt's definition of intent.
export function productDeliveryIntentHeuristic(content: string): boolean {
  const text = content
  const explicitDelivery = /(全自动|完整权限|完全控制|自动完成|直到交付|交付产物|生成为产物|登记为产物|作为产物|纳入产物|收口为产物|产物)/.test(text)
  const canonicalProductPrompt = /sqlite|SQLite|历史记录/.test(text)
    && /(网站|网页|页面|应用|服务)/.test(text)
    && /(加减乘除|计算器|生成姓名|姓名生成|姓名)/.test(text)
  // A concrete deliverable file extension is itself sufficient intent — no verb needed.
  // Use a non-alphanumeric lookahead instead of \b because \b is unreliable when the
  // extension is preceded by a CJK char or sits at end-of-string.
  const deliverableFile = /\.(md|markdown|docx?|pdf|pptx?|xlsx?|html?)(?![a-z0-9])/i.test(text)
  const deliverableNoun = /(网页|网站|页面|应用|服务|文档|markdown|Markdown|PPT|ppt|pptx|演示稿|幻灯片|报告|word|excel|表格)/
  const generatedProductPrompt = /(生成|做一个|做个|创建|实现|开发|写一个|写个|制作|产出|交付|导出|输出)/.test(text)
    && deliverableNoun.test(text)
  return explicitDelivery || deliverableFile || canonicalProductPrompt || generatedProductPrompt
}

function resolveClaudeBinary(): string | null {
  const result = spawnSync('sh', ['-lc', 'command -v claude || true'], { encoding: 'utf8', timeout: 3000 })
  const path = typeof result.stdout === 'string' ? result.stdout.split(/\r?\n/).find(Boolean) ?? '' : ''
  return path || null
}

const INTENT_PROMPT = [
  '你是意图分类器。判断用户这句话是否要求"产出/交付一个可下载或可运行的成果物"',
  '（例如网页、网站、应用、服务、Markdown 文档、PPT/演示稿、PDF、Word、报告等），',
  '包括"把已有文件登记/确认/生成为产物"这类收口诉求。',
  '只输出一个词：YES 或 NO，不要任何其他内容。',
  '',
  '用户输入：',
].join('\n')

// Ask the authenticated claude CLI (headless print mode) whether the message expresses
// a product-delivery intent. Falls back to the keyword heuristic on any failure so the
// orchestrator never loses artifact closure just because the CLI is missing or slow.
export async function classifyProductDeliveryIntent(content: string): Promise<boolean> {
  const binary = resolveClaudeBinary()
  if (!binary) return productDeliveryIntentHeuristic(content)

  const timeoutMs = Number(process.env.INTENT_CLASSIFIER_TIMEOUT_MS ?? 20_000)
  try {
    const verdict = await new Promise<string | null>((resolve) => {
      const child = spawn(binary, ['-p', '--output-format', 'text'], {
        stdio: ['pipe', 'pipe', 'ignore'],
        env: process.env,
      })
      let out = ''
      const timer = setTimeout(() => { child.kill('SIGTERM'); resolve(null) }, timeoutMs)
      child.stdout.on('data', (chunk) => { out += chunk.toString() })
      child.on('error', () => { clearTimeout(timer); resolve(null) })
      child.on('close', () => { clearTimeout(timer); resolve(out) })
      child.stdin.end(`${INTENT_PROMPT}${content}`)
    })
    if (verdict == null) return productDeliveryIntentHeuristic(content)
    const normalized = verdict.trim().toUpperCase()
    if (normalized.startsWith('YES')) return true
    if (normalized.startsWith('NO')) return false
    return productDeliveryIntentHeuristic(content)
  } catch {
    return productDeliveryIntentHeuristic(content)
  }
}
