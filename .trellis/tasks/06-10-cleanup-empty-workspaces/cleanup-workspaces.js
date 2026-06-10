const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const repoRoot = path.resolve(__dirname, '../../..')
const { Pool } = require(path.join(repoRoot, 'apps/web/node_modules/pg'))

const mode = process.argv.includes('--api-execute')
  ? 'api-execute'
  : process.argv.includes('--prune-orphan-dirs')
    ? 'prune-orphan-dirs'
  : process.argv.includes('--execute')
    ? 'execute'
    : 'dry-run'
const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://agenthub:agenthub_dev@localhost:5432/agenthub_acceptance'
const taskDir = __dirname
const cloudRoot = path.resolve(process.env.AGENTHUB_CLOUD_WORKSPACE_ROOT || path.join(os.homedir(), '.agenthub', 'cloud-workspaces'))

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const env = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1)
  }
  return env
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function safeCloudDir(value) {
  if (!value) return null
  const resolved = path.resolve(value)
  if (resolved === cloudRoot || !resolved.startsWith(`${cloudRoot}${path.sep}`)) return null
  return resolved
}

async function loadSnapshot(pool) {
  const workspaces = await pool.query(`
    WITH workspace_stats AS (
      SELECT
        w.id,
        count(DISTINCT s.id)::int AS sessions,
        count(DISTINCT m.id)::int AS messages,
        count(DISTINCT a.id)::int AS artifacts,
        count(DISTINCT r.id)::int AS roles
      FROM public.workspaces w
      LEFT JOIN public.sessions s ON s.workspace_id = w.id
      LEFT JOIN public.messages m ON m.session_id = s.id
      LEFT JOIN public.artifacts a ON a.workspace_id = w.id
      LEFT JOIN public.role_agents r ON r.workspace_id = w.id
      GROUP BY w.id
    )
    SELECT
      w.id::text,
      w.owner_id,
      w.name,
      w.description,
      w.execution_domain::text,
      w.cloud_project_dir,
      w.local_root_display,
      w.created_at,
      w.updated_at,
      ws.sessions,
      ws.messages,
      ws.artifacts,
      ws.roles
    FROM public.workspaces w
    JOIN workspace_stats ws ON ws.id = w.id
    ORDER BY w.created_at DESC
  `)

  const sessions = await pool.query(`
    SELECT
      s.id::text,
      s.workspace_id::text,
      s.name,
      s.status::text,
      s.created_at,
      count(m.id)::int AS messages
    FROM public.sessions s
    LEFT JOIN public.messages m ON m.session_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `)

  return {
    capturedAt: new Date().toISOString(),
    database: 'local acceptance database',
    criteria: 'delete workspaces where artifact count is 0',
    cloudRoot,
    workspaces: workspaces.rows,
    sessions: sessions.rows,
  }
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl })
  const reportPath = path.join(taskDir, `workspace-cleanup-${mode}-${timestamp()}.json`)
  try {
    const snapshot = await loadSnapshot(pool)
    const candidates = snapshot.workspaces.filter((workspace) => workspace.artifacts === 0)
    const keep = snapshot.workspaces.filter((workspace) => workspace.artifacts > 0)
    const report = {
      mode,
      ...snapshot,
      summary: {
        totalWorkspaces: snapshot.workspaces.length,
        deleteCandidates: candidates.length,
        keepWithArtifacts: keep.length,
      },
      candidates,
      keepWithArtifacts: keep,
      deleted: [],
      removedDirs: [],
      skippedDirs: [],
      errors: [],
    }

    if (mode === 'prune-orphan-dirs') {
      const referencedDirs = new Set(
        snapshot.workspaces
          .map((workspace) => safeCloudDir(workspace.cloud_project_dir))
          .filter(Boolean),
      )
      const owners = await fs.promises.readdir(cloudRoot, { withFileTypes: true }).catch(() => [])
      const dirs = []
      for (const owner of owners) {
        if (!owner.isDirectory()) continue
        const ownerDir = path.join(cloudRoot, owner.name)
        const entries = await fs.promises.readdir(ownerDir, { withFileTypes: true }).catch(() => [])
        for (const entry of entries) {
          if (entry.isDirectory()) dirs.push(path.join(ownerDir, entry.name))
        }
      }
      report.orphanDirs = dirs.filter((dir) => !referencedDirs.has(path.resolve(dir))).sort()
      for (const dir of report.orphanDirs) {
        try {
          await fs.promises.rm(dir, { recursive: true, force: true })
          report.removedDirs.push({ path: dir })
        } catch (error) {
          report.errors.push({ path: dir, error: error instanceof Error ? error.message : String(error) })
        }
      }
    }

    if (mode === 'api-execute' && candidates.length > 0) {
      const env = loadEnvFile(path.join(repoRoot, 'docker/.acceptance.env'))
      const baseUrl = process.env.BASE_URL || env.BASE_URL || 'http://localhost:3000'
      const cookie = process.env.TEST_AUTH_COOKIE || env.TEST_AUTH_COOKIE
      if (!cookie) throw new Error('TEST_AUTH_COOKIE is required for API deletion')

      report.api = { baseUrl, ok: [], failed: [] }
      for (const workspace of candidates) {
        const response = await fetch(`${baseUrl}/api/workspaces/${workspace.id}`, {
          method: 'DELETE',
          headers: { cookie },
        })
        const bodyText = await response.text().catch(() => '')
        if (response.ok) {
          report.api.ok.push({ id: workspace.id, name: workspace.name, status: response.status })
          report.deleted.push(workspace.id)
        } else {
          report.api.failed.push({
            id: workspace.id,
            name: workspace.name,
            status: response.status,
            body: bodyText.slice(0, 500),
          })
        }
      }
    }

    if (mode === 'execute' && candidates.length > 0) {
      const ids = candidates.map((workspace) => workspace.id)
      await pool.query('BEGIN')
      try {
        const deleted = await pool.query(
          'DELETE FROM public.workspaces WHERE id = ANY($1::uuid[]) RETURNING id::text',
          [ids],
        )
        await pool.query('COMMIT')
        report.deleted = deleted.rows.map((row) => row.id)
      } catch (error) {
        await pool.query('ROLLBACK')
        throw error
      }

      for (const workspace of candidates) {
        if (!report.deleted.includes(workspace.id)) continue
        const dir = safeCloudDir(workspace.cloud_project_dir)
        if (!dir) {
          report.skippedDirs.push({ id: workspace.id, path: workspace.cloud_project_dir, reason: 'outside cloud root or empty' })
          continue
        }
        try {
          await fs.promises.rm(dir, { recursive: true, force: true })
          report.removedDirs.push({ id: workspace.id, path: dir })
        } catch (error) {
          report.errors.push({ id: workspace.id, path: dir, error: error instanceof Error ? error.message : String(error) })
        }
      }
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(JSON.stringify({
      mode,
      reportPath: path.relative(repoRoot, reportPath),
      summary: report.summary,
      deleted: report.deleted.length,
      apiOk: report.api?.ok?.length ?? 0,
      apiFailed: report.api?.failed?.length ?? 0,
      removedDirs: report.removedDirs.length,
      orphanDirs: report.orphanDirs?.length ?? 0,
      skippedDirs: report.skippedDirs.length,
      errors: report.errors.length,
    }))
  } finally {
    await pool.end().catch(() => undefined)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
