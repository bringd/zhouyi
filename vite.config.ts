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
      // Dev-only: the three-process dev setup is
      //   :5173 Vite  +  :8787 wrangler dev (Worker)  +  :8788 wrangler pages dev.
      // The frontend calls these paths same-origin (so the
      // `zhouyi_session` cookie is sent), and Vite forwards them to
      // whichever process actually owns the route.
      //
      // The Worker mounts these at the *same* paths (worker/src/index.ts:
      // app.route('/api/auth', …), '/api/records', '/api/favorites'), so no
      // path rewrite is needed — the prefix is preserved as-is.
      '/api/auth': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
      '/api/records': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
      '/api/favorites': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
      // The AI proxy is a Pages Function, not a Worker route, so it lives
      // on the `wrangler pages dev` port instead. `wrangler pages dev`
      // serves a Function at the path mirroring its file location —
      // functions/api/proxy/anthropic/v1/messages.ts is served at
      // /api/proxy/anthropic/v1/messages — so the prefix must be
      // preserved here too (stripping it would 404).
      '/api/proxy/anthropic': {
        target: 'http://localhost:8788',
        changeOrigin: true,
        secure: false,
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
