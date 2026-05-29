import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', '')

  return {
    plugins: [react(), tailwindcss()],
    root: 'src/renderer',
    base: './',
    define: {
      'import.meta.env.APP_BASE_URL': JSON.stringify(env.APP_BASE_URL ?? ''),
    },
    build: {
      outDir: '../../dist/renderer',
      emptyOutDir: true,
    },
    server: {
      port: 5173,
    },
  }
})
