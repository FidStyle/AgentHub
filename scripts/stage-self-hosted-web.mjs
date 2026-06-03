#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const webRoot = path.join(repoRoot, 'apps/web')
const nextRoot = path.join(webRoot, '.next')
const buildIdPath = path.join(nextRoot, 'BUILD_ID')
const publicSource = path.join(webRoot, 'public')
const nextStaticSource = path.join(nextRoot, 'static')
const deployRoot = path.resolve(repoRoot, process.env.AGENTHUB_DEPLOY_DIR ?? 'deploy/self-hosted')

function assertPath(pathname, message) {
  if (!existsSync(pathname)) {
    console.error(message)
    process.exit(1)
  }
}

assertPath(buildIdPath, 'Missing apps/web/.next/BUILD_ID. Run pnpm --filter @agenthub/web build first.')
assertPath(nextStaticSource, 'Missing apps/web/.next/static. Next static assets were not built.')

const buildId = readFileSync(buildIdPath, 'utf8').trim()
if (!buildId) {
  console.error('apps/web/.next/BUILD_ID is empty.')
  process.exit(1)
}

const releasesRoot = path.join(deployRoot, 'releases')
const releaseRoot = path.join(releasesRoot, buildId)
const releasePublicRoot = path.join(releaseRoot, 'public')
const nextStaticTarget = path.join(releasePublicRoot, '_next/static')
const manifest = {
  buildId,
  createdAt: new Date().toISOString(),
  release: path.relative(repoRoot, releaseRoot),
  publicRoot: path.relative(repoRoot, releasePublicRoot),
  nextStatic: path.relative(repoRoot, nextStaticTarget),
}

rmSync(releaseRoot, { recursive: true, force: true })
mkdirSync(releasePublicRoot, { recursive: true })

if (existsSync(publicSource)) {
  cpSync(publicSource, releasePublicRoot, { recursive: true })
}
mkdirSync(path.dirname(nextStaticTarget), { recursive: true })
cpSync(nextStaticSource, nextStaticTarget, { recursive: true })

writeFileSync(path.join(releaseRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
writeFileSync(path.join(deployRoot, 'current-release'), `${buildId}\n`)

const currentPath = path.join(deployRoot, 'current')
rmSync(currentPath, { recursive: true, force: true })
symlinkSync(path.relative(deployRoot, releaseRoot), currentPath, 'dir')

console.log(`Staged AgentHub web static release ${buildId}`)
console.log(`Static root: ${path.relative(repoRoot, releasePublicRoot)}`)
