/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Dev-only CORS bypass for the BYOK Anthropic call (MiniMax
      // / Anthropic only allow the production origin in their
      // Access-Control-Allow-Origin, so a direct browser call from
      // http://localhost:5173 is rejected by the browser's CORS
      // preflight). Vite forwards /api-proxy/* to the real endpoint
      // and strips the /api-proxy prefix.
      '/api-proxy': {
        target: 'https://api.minimaxi.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api-proxy/, ''),
      },
      // Dev-only: forward community-feed calls to the local Workers
      // dev server (wrangler dev runs on :8787 by default). Strip the
      // /api-feed prefix so /api-feed/api/feed → http://localhost:8787/api/feed.
      '/api-feed': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api-feed/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: ['tests/worker/**', '**/node_modules/**', '**/dist/**'],
  },
})
