import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const repoRoot = path.resolve(__dirname, '..', '..')
  const env = loadEnv(mode, repoRoot, '')
  const apiTarget = env.VITE_PROXY_API ?? 'http://127.0.0.1:3000'

  return {
    envDir: repoRoot,
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
