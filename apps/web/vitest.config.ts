import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [path.resolve(__dirname, '__tests__/**/*.test.ts')],
    exclude: [
      ...(process.env.RUN_DB_INTEGRATION === '1' ? [] : [path.resolve(__dirname, '__tests__/integration/**/*.test.ts')]),
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
