/**
 * Zhouyi Cloudflare Worker — main entry.
 *
 * Routes:
 *   GET  /health                liveness
 *   ALL  /api/feed*             community feed (session required)
 *   ALL  /api/records*          user divination history (session required)
 *   ALL  /api/favorites*        user favorites (session required)
 *   POST /api/ai/interpret     BYOK stub (returns 503)
 *
 * All cross-origin requests from the Pages frontend are allowed
 * when their Origin matches FRONTEND_ORIGIN.
 */
import { Hono } from 'hono'
import { corsMiddleware } from './middleware/cors'
import { sessionMiddleware } from './middleware/session'
import { errorHandler } from './middleware/errorHandler'
import { healthRouter } from './routes/health'
import { feedRouter } from './routes/feed'
import { recordsRouter } from './routes/records'
import { favoritesRouter } from './routes/favorites'
import { aiRouter } from './routes/ai'

export interface Env {
  DB: D1Database
  FRONTEND_ORIGIN?: string
}

const app = new Hono<{ Bindings: Env }>()

// Global error handler — keeps the response shape tidy.
app.onError(errorHandler)

// CORS for every request (handles preflight internally).
app.use('*', corsMiddleware)

// Health is mounted BEFORE the session middleware so it doesn't
// touch the DB on every probe.
app.route('/health', healthRouter)

// Mount session middleware for everything else. The /api/ai/* routes
// are still safe under session (the stub doesn't care who's calling).
app.use('/api/*', sessionMiddleware)

// API routes
app.route('/api/feed', feedRouter)
app.route('/api/records', recordsRouter)
app.route('/api/favorites', favoritesRouter)
app.route('/api/ai', aiRouter)

export default app
