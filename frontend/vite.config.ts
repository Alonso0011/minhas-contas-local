import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  base: './',
  define: { __APP_MODE__: JSON.stringify(mode === 'demo' ? 'demo' : 'personal') },
  plugins: [react(), tailwindcss()],
  build: { outDir: mode === 'demo' ? 'dist-demo' : 'dist' },
  server: {
    port: 5173,
    strictPort: true,
    proxy: mode === 'demo' ? undefined : { '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000' },
  },
}))
