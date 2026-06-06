#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { auditAcceptanceEvidence } from './audit-acceptance-evidence.mjs'

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

function withFixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agenthub-audit-'))
  try {
    fn(root)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

withFixture((root) => {
  const taskId = 'WORKBENCH-STRICT-PRODUCT-LINE-2026-06-06'
  write(path.join(root, 'research/project-tracker.md'), `
### ${taskId}: 严格工作台主链路闭环

| 字段 | 内容 |
| --- | --- |
| **当前状态** | in_progress / partial：不能写 completed，REG-20260606-003 open。 |
| **测试证据** | Report: research/execution-reports/workbench.md；历史 session 只做 right-panel timeline readback，不计为 fresh pass。 |
| **阻塞问题** | REG-20260606-003 open：三端 fresh IM-first strict session 未完成。 |
`)
  write(path.join(root, 'research/regression-ledger.md'), `
### REG-20260606-003 — IM 对话中缺少 Orchestrator 分工、真实角色回复和循环验收

| 字段 | 内容 |
| --- | --- |
| **优先级** | P0 |
| **状态** | \`open\` |
| **关联任务/合同** | ${taskId} |
`)
  write(path.join(root, 'research/contracts', `${taskId}.md`), 'Bytedance IM-first Orchestrator 架构师 前端工程师 后端工程师 产物推荐')
  write(path.join(root, 'research/execution-reports/workbench.md'), 'timeline-only 历史证据')

  const result = auditAcceptanceEvidence({ root, taskId })
  assert.equal(result.ok, false)
  assert.equal(result.classification, 'failed')
  assert(result.checks.some((check) => check.label === 'related open P0 regressions' && check.status === 'fail'))
  assert(result.checks.some((check) => check.label === 'completion status' && check.status === 'fail'))
})

withFixture((root) => {
  const taskId = 'STRICT-SAMPLE-2026-06-06'
  write(path.join(root, 'research/project-tracker.md'), `
### ${taskId}: strict pass

| 字段 | 内容 |
| --- | --- |
| **当前状态** | ✅ completed / 验证通过：fresh strict pass。 |
| **测试证据** | Web PASS；Mobile PASS；Desktop fallback PASS；GET /api/messages shows Orchestrator 架构师分工, 前端工程师 runtime 回复, 后端工程师 runtime 回复, handoff metadata, 架构师验收 validation, artifact recommendation 产物推荐 confirmation。 |
| **阻塞问题** | 无。 |
`)
  write(path.join(root, 'research/regression-ledger.md'), '# empty')
  write(path.join(root, 'research/contracts', `${taskId}.md`), 'Bytedance IM-first Orchestrator 架构师 前端工程师 后端工程师 artifact recommendation')
  write(path.join(root, 'research/execution-reports/strict-sample.md'), `
Task ${taskId}
GET /api/messages?session_id=abc
Orchestrator 架构师 分工 allocation
前端工程师 runtime 回复 收到 handoff roleHandoffs
后端工程师 runtime 回复 收到 handoffsReceived
架构师 验收 validation
产物 推荐 artifact recommendation confirmation
Web PASS
Mobile PASS
Desktop fallback PASS
`)

  const result = auditAcceptanceEvidence({ root, taskId })
  assert.equal(result.ok, true)
  assert.equal(result.classification, 'product-pass')
  assert.equal(result.checks.filter((check) => check.status === 'fail').length, 0)
})

console.log('audit-acceptance-evidence tests passed')
