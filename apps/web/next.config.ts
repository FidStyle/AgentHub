import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import type { NextConfig } from 'next'

const webRoot = process.cwd()
const repoRoot = path.resolve(webRoot, '../..')

const buildIdInputs = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'apps/web/package.json',
  'apps/web/next.config.ts',
  'apps/web/app',
  'apps/web/auth.ts',
  'apps/web/components',
  'apps/web/lib',
  'apps/web/middleware.ts',
  'apps/web/server',
  'apps/web/server.ts',
  'apps/web/store',
  'apps/web/public',
  'packages/shared/package.json',
  'packages/shared/src',
  'packages/ui/package.json',
  'packages/ui/src',
]

function hashPath(hash: ReturnType<typeof createHash>, relativePath: string) {
  const absolutePath = path.join(repoRoot, relativePath)
  if (!existsSync(absolutePath)) {
    return
  }

  const stats = statSync(absolutePath)
  if (stats.isDirectory()) {
    for (const entry of readdirSync(absolutePath).sort()) {
      if (entry === '.next' || entry === 'node_modules') {
        continue
      }
      hashPath(hash, path.join(relativePath, entry))
    }
    return
  }

  if (!stats.isFile()) {
    return
  }

  hash.update(relativePath)
  hash.update('\0')
  hash.update(readFileSync(absolutePath))
  hash.update('\0')
}

function createDeterministicBuildId() {
  const explicitBuildId = process.env.AGENTHUB_WEB_BUILD_ID?.trim()
  if (explicitBuildId) {
    return explicitBuildId.replace(/[^A-Za-z0-9_-]/g, '-')
  }

  const hash = createHash('sha256')
  for (const input of buildIdInputs) {
    hashPath(hash, input)
  }
  return `agenthub-${hash.digest('hex').slice(0, 24)}`
}

const nextConfig: NextConfig = {
  transpilePackages: ['@agenthub/shared'],
  generateBuildId: createDeterministicBuildId,
  webpack(config) {
    config.resolve = config.resolve ?? {}
    config.resolve.alias = {
      ...config.resolve.alias,
      'pg-native': false,
    }
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.next/**',
        '**/refer_proj/**',
        '**/refer_e2e_proj/**',
        '**/.workflow/**',
        '**/.trellis/**',
        '**/e2e/artifacts/**',
      ],
    }
    return config
  },
}

export default nextConfig
