#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const COMPLETE_PATTERNS = [
  /✅.*(completed|完成|通过)/i,
  /\bcompleted\b/i,
  /\bclosed\b/i,
  /全部完成/,
  /验证通过/,
  /fresh strict pass/i,
]

const BLOCKING_STATUS_PATTERNS = [
  /\bin_progress\b/i,
  /\bpartial\b/i,
  /\bblocked\b/i,
  /\bnot-run\b/i,
  /\bnot accepted\b/i,
  /\bim-first-open\b/i,
  /不能写\s*completed/i,
  /未计入通过/,
  /不声明/,
  /尚未完成/,
  /等待.*验收/,
  /fixed_pending_verify/i,
]

const PRODUCT_FLOW_PATTERNS = [
  /Bytedance/i,
  /IM-first/i,
  /single[- ]prompt/i,
  /Orchestrator|架构师/,
  /前端工程师|后端工程师/,
  /产物推荐|artifact recommendation/i,
]

const IM_FIRST_REQUIRED = [
  ['IM transcript API', /\/api\/messages|GET \/api\/messages/i],
  ['Orchestrator allocation', /(Orchestrator|架构师).{0,80}(分工|派发|规划|allocation|assign)/is],
  ['Worker role replies', /((前端工程师|后端工程师).{0,120}(回复|执行|runtime|handoff|交接|收到)|后端.{0,20}前端.{0,40}角色回复|backend.{0,40}frontend.{0,40}role replies)/is],
  ['Handoff or code reference', /(handoff|roleHandoffs|handoffsReceived|交接|引用|code reference|代码引用)/i],
  ['Orchestrator validation', /(Orchestrator|架构师).{0,120}(验收|验证|重派|redispatch|validation|acceptance)/is],
  ['Artifact recommendation', /(产物|artifact).{0,80}(推荐|确认|confirmation|recommendation)/is],
]

const SURFACE_REQUIRED = [
  ['Web surface', /(Web|web).{0,80}(pass|PASS|通过|passed)/s],
  ['Mobile/PWA surface', /(Mobile|PWA|mobile).{0,80}(pass|PASS|通过|passed)/s],
  ['Desktop/Electron surface', /(Desktop|Electron|desktop).{0,80}(pass|PASS|通过|passed|fallback)/s],
]

const SURFACE_NEGATION = /(No Web\/Mobile\/Desktop fresh UAT pass is claimed|三端 fresh UAT 未计入通过|未声明.*三端|not-run|blocked|fresh UAT 未.*pass|不计为 fresh pass)/i

function usage() {
  console.error('用法: node scripts/audit-acceptance-evidence.mjs <TASK-ID> [--root <repo>] [--json] [--allow-partial]')
}

function parseArgs(argv) {
  let taskId = ''
  let root = process.cwd()
  let json = false
  let allowPartial = false
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--root') {
      root = argv[i + 1] || root
      i += 1
    } else if (arg === '--json') {
      json = true
    } else if (arg === '--allow-partial') {
      allowPartial = true
    } else if (!taskId) {
      taskId = arg
    } else {
      throw new Error(`未知参数: ${arg}`)
    }
  }
  if (!taskId) {
    usage()
    process.exit(2)
  }
  return { taskId, root: path.resolve(root), json, allowPartial }
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFiles(full))
    else if (entry.isFile()) out.push(full)
  }
  return out
}

function extractHeadingSection(markdown, headingPrefix) {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => line.startsWith(headingPrefix))
  if (start === -1) return ''
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith('### ')) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n')
}

function extractTableField(section, fieldName) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = section.match(new RegExp(`^\\| \\*\\*${escaped}\\*\\* \\|([^\\n]+)\\|`, 'm'))
  return match ? match[1].trim() : ''
}

function hasAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text))
}

function surfaceCheck(label, pattern, text, negationText = text) {
  if (SURFACE_NEGATION.test(negationText)) {
    return check('fail', label, '三端证据明确标注为未运行、阻塞或不计入通过')
  }
  return pattern.test(text)
    ? check('pass', label)
    : check('fail', label, '三端状态未明确 pass/blocked/not-run 分类或未提供通过证据')
}

function relatedOpenRegressions(ledger, taskId) {
  const parts = ledger.split(/\n(?=### REG-)/)
  return parts
    .filter((section) => section.startsWith('### REG-'))
    .map((section) => {
      const id = (section.match(/^### (REG-\d+-\d+)/) || [])[1] || 'UNKNOWN'
      const status = extractTableField(section, '状态')
      const priority = extractTableField(section, '优先级')
      const isOpen = /\b(open|in_progress|blocked|fixed_pending_verify)\b/i.test(status)
      const isBlockingPriority = /P0|blocker|阻塞/i.test(priority)
      const isRelated = section.includes(taskId)
      return { id, status, priority, isOpen, isBlockingPriority, isRelated }
    })
    .filter((item) => item.isOpen && item.isBlockingPriority && item.isRelated)
}

function findReports(root, taskId) {
  const reportsDir = path.join(root, 'research', 'execution-reports')
  const searchPrefix = taskId.split('-').slice(0, 2).join('-').toLowerCase()
  return listFiles(reportsDir)
    .filter((file) => {
      const name = path.basename(file).toLowerCase()
      const text = readIfExists(file)
      return text.includes(taskId) || name.includes(searchPrefix)
    })
    .sort()
}

function scanTestRisk(root) {
  const candidates = [
    path.join(root, 'e2e', 'tests'),
    path.join(root, 'apps', 'web', '__tests__'),
  ]
  const files = candidates.flatMap(listFiles).filter((file) => /\.(ts|tsx|js|jsx|mjs)$/.test(file))
  const risk = {
    pageRoute: 0,
    visibleOnly: 0,
    testSkip: 0,
    runtimeFake: 0,
    mock: 0,
  }
  for (const file of files) {
    const text = readIfExists(file)
    if (/page\.route\(/.test(text)) risk.pageRoute += 1
    if (/toBeVisible\(/.test(text)) risk.visibleOnly += 1
    if (/test\.skip|describe\.skip|it\.skip/.test(text)) risk.testSkip += 1
    if (/RUNTIME_EXECUTOR\s*[:=]\s*['"]?(fake|script)/i.test(text)) risk.runtimeFake += 1
    if (/\bvi\.mock\b|\bmockResolvedValue\b|\bmockImplementation\b/.test(text)) risk.mock += 1
  }
  return risk
}

function check(status, label, detail = '') {
  return { status, label, detail }
}

export function auditAcceptanceEvidence({ root, taskId, allowPartial = false }) {
  const trackerPath = path.join(root, 'research', 'project-tracker.md')
  const ledgerPath = path.join(root, 'research', 'regression-ledger.md')
  const contractPath = path.join(root, 'research', 'contracts', `${taskId}.md`)
  const tracker = readIfExists(trackerPath)
  const ledger = readIfExists(ledgerPath)
  const contract = readIfExists(contractPath)
  const section = extractHeadingSection(tracker, `### ${taskId}`)
  const statusField = extractTableField(section, '当前状态')
  const evidenceField = extractTableField(section, '测试证据')
  const blockerField = extractTableField(section, '阻塞问题')
  const reports = findReports(root, taskId)
  const reportText = reports.map(readIfExists).join('\n\n')
  const combined = [section, contract, reportText].join('\n\n')
  const currentEvidenceText = [statusField, evidenceField, blockerField, reportText].join('\n\n')
  const trackerEvidenceText = [statusField, evidenceField, blockerField].join('\n\n')
  const checks = []

  checks.push(section ? check('pass', 'tracker section', `research/project-tracker.md#${taskId}`) : check('fail', 'tracker section', '缺少当前任务记录'))

  if (!statusField) {
    checks.push(check('fail', 'current status field', '缺少「当前状态」字段'))
  } else {
    const complete = hasAny(statusField, COMPLETE_PATTERNS)
    const blocked = hasAny(statusField, BLOCKING_STATUS_PATTERNS)
    if (complete && !blocked) checks.push(check('pass', 'completion status', statusField))
    else if (allowPartial && blocked) checks.push(check('warn', 'completion status', statusField))
    else checks.push(check('fail', 'completion status', statusField))
  }

  if (evidenceField && !/(待执行|待补充|无|N\/A|TODO)/i.test(evidenceField)) {
    checks.push(check('pass', 'test evidence field', evidenceField.slice(0, 180)))
  } else {
    checks.push(check('fail', 'test evidence field', '缺少可复现测试证据'))
  }

  const openRegs = relatedOpenRegressions(ledger, taskId)
  if (openRegs.length === 0) {
    checks.push(check('pass', 'related open P0 regressions', 'none'))
  } else {
    checks.push(check('fail', 'related open P0 regressions', openRegs.map((item) => `${item.id}:${item.status}`).join(', ')))
  }

  if (reports.length > 0) {
    checks.push(check('pass', 'execution report', reports.map((file) => path.relative(root, file)).join(', ')))
  } else {
    checks.push(check('fail', 'execution report', 'research/execution-reports 中未找到相关报告'))
  }

  const productFlow = hasAny(combined, PRODUCT_FLOW_PATTERNS)
  if (productFlow) {
    for (const [label, pattern] of IM_FIRST_REQUIRED) {
      checks.push(pattern.test(combined) ? check('pass', label) : check('fail', label, 'IM-first 产品主链路缺少该证据'))
    }
    for (const [label, pattern] of SURFACE_REQUIRED) {
      checks.push(surfaceCheck(label, pattern, combined, currentEvidenceText))
    }
    if (/(historical evidence|历史证据|历史截图|历史 session|旧 session|timeline-only|right-panel-only)/i.test(trackerEvidenceText)) {
      checks.push(check('warn', 'historical/timeline-only evidence marker', '发现历史或 timeline-only 证据，不能单独作为 product pass'))
    }
  } else {
    checks.push(check('pass', 'product-flow trigger', 'not applicable'))
  }

  const mixedLanguageText = `${statusField}\n${evidenceField}\n${blockerField}`
    .replace(/\b0 failed\b/gi, '')
    .replace(/\b0 failed \/ 0 warned\b/gi, '')
  if (/(全部通过|验证通过|completed|fresh strict pass)/i.test(mixedLanguageText) &&
      /(\bpartial\b|\bnot-run\b|\bblocked\b|\bopen\b|\bfixed_pending_verify\b|未计入通过|不声明|不能写 completed)/i.test(mixedLanguageText)) {
    checks.push(check('fail', 'mixed pass and blocking language', '同一任务记录同时包含完成语义和阻塞/partial 语义'))
  }

  const testRisk = scanTestRisk(root)
  const riskDetail = Object.entries(testRisk).map(([key, value]) => `${key}=${value}`).join(', ')
  checks.push(check('info', 'test-suite risk scan', riskDetail))

  const failures = checks.filter((item) => item.status === 'fail')
  const warnings = checks.filter((item) => item.status === 'warn')
  let classification = 'product-pass'
  if (failures.length > 0) classification = allowPartial ? 'partial' : 'failed'
  else if (warnings.length > 0) classification = 'partial'

  return {
    taskId,
    classification,
    ok: failures.length === 0 || allowPartial,
    checks,
    openRegressions: openRegs,
    reports: reports.map((file) => path.relative(root, file)),
  }
}

function printTable(result) {
  console.log(`Acceptance Evidence Audit: ${result.taskId}`)
  console.log(`Classification: ${result.classification}`)
  console.log('')
  console.log('| Gate | Status | Detail |')
  console.log('| --- | --- | --- |')
  for (const item of result.checks) {
    const detail = item.detail ? item.detail.replace(/\|/g, '\\|').replace(/\n/g, ' ') : ''
    console.log(`| ${item.label} | ${item.status} | ${detail} |`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv)
    const result = auditAcceptanceEvidence(args)
    if (args.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      printTable(result)
    }
    process.exit(result.ok ? 0 : 1)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(2)
  }
}
