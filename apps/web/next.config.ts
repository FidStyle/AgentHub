import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@agenthub/shared'],
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
