import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { startArtifactPublish, stopArtifactPublish } from '@/lib/artifacts/publish-service'

let tmpDirs: string[] = []

async function makeWorkspace() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'agenthub-publish-'))
  tmpDirs.push(dir)
  return dir
}

// Minimal DB stub matching the chained query surface startArtifactPublish touches.
function stubDb() {
  const updates: Array<Record<string, unknown>> = []
  return {
    updates,
    from() {
      let pendingUpdate: Record<string, unknown> | null = null
      const query: Record<string, unknown> = {
        select: () => query,
        insert: () => query,
        update: (values: Record<string, unknown>) => { pendingUpdate = values; updates.push(values); return query },
        eq: () => query,
        single: () => ({ data: pendingUpdate ?? {}, error: null }),
      }
      return query
    },
  }
}

afterEach(async () => {
  await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })))
  tmpDirs = []
})

describe('artifact publish port discovery', () => {
  it('discovers the real LISTEN port when the app ignores the injected PORT', async () => {
    const root = await makeWorkspace()
    await mkdir(path.join(root, 'public'), { recursive: true })
    // Pre-create node_modules so the generated start script skips `npm install`
    // (the fixture server only uses Node built-ins).
    await mkdir(path.join(root, 'node_modules'), { recursive: true })
    await writeFile(path.join(root, 'public', 'index.html'), '<!doctype html><h1>ok</h1>')
    await writeFile(path.join(root, 'package.json'), JSON.stringify({
      name: 'fixed-port-app',
      scripts: { start: 'node server.js' },
    }))
    // The server hard-codes a self-chosen port and never reads process.env.PORT,
    // mirroring a plain Express/Node app. The publisher must still find it.
    await writeFile(path.join(root, 'server.js'), [
      "const http = require('http')",
      "const fs = require('fs')",
      "const path = require('path')",
      'const server = http.createServer((req, res) => {',
      "  if (req.url === '/' || req.url === '/index.html') {",
      "    res.writeHead(200, { 'content-type': 'text/html' })",
      "    res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')))",
      '    return',
      '  }',
      '  res.writeHead(404); res.end()',
      '})',
      // Listen on an OS-assigned port (0) so it never collides and never matches
      // the publisher's requested port — only process-tree discovery can find it.
      'server.listen(0, "127.0.0.1")',
    ].join('\n'))

    const db = stubDb()
    const row = {
      id: 'pub-fixed-1',
      workspace_id: 'ws-1',
      session_id: null,
      title: 'fixed port app',
      source_path: 'public/index.html',
      artifact_type: 'html',
      metadata: { packageScript: 'start' },
    }

    try {
      const result = await startArtifactPublish({ db, row, workspaceRoot: root, persistMessage: false })
      expect(result.status).toBe('running')
      expect(result.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
      const probe = await fetch(result.url)
      expect(probe.ok).toBe(true)
      expect(await probe.text()).toContain('ok')
    } finally {
      stopArtifactPublish(row)
    }
  }, 30_000)
})
