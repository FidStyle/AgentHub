import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../..', '')
  const appBaseUrl = process.env.VITE_APP_BASE_URL ?? process.env.APP_BASE_URL ?? env.VITE_APP_BASE_URL ?? env.APP_BASE_URL ?? ''
  const webBaseUrl = process.env.VITE_WEB_BASE_URL ?? env.VITE_WEB_BASE_URL ?? ''

  return {
    plugins: [react(), tailwindcss()],
    root: 'src/renderer',
    base: './',
    define: {
      'import.meta.env.VITE_APP_BASE_URL': JSON.stringify(appBaseUrl),
      'import.meta.env.APP_BASE_URL': JSON.stringify(appBaseUrl),
      'import.meta.env.VITE_WEB_BASE_URL': JSON.stringify(webBaseUrl),
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
