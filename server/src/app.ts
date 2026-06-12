import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import { config } from './config.js'
import { requestLogger } from './middleware/requestLogger.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { sessionMiddleware } from './middleware/session.js'
import { healthRouter } from './routes/health.js'
import { aiRouter } from './routes/ai.js'
import { recordsRouter } from './routes/records.js'
import { favoritesRouter } from './routes/favorites.js'

/**
 * Express app factory. Separated from index.ts so tests can import
 * the app without triggering listen().
 *
 * Frontend is hosted separately on Cloudflare Pages — this service is
 * API-only. CORS is the bridge: the browser sends the request with
 * Origin: <Cloudflare Pages URL>, and we allow that origin here.
 */
export function createApp(): Express {
  const app = express()

  // Security & utility middleware
  app.use(helmet())
  app.use(
    cors({
      origin: config.FRONTEND_ORIGIN,
      credentials: true,
    })
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  // Logging
  if (config.NODE_ENV !== 'test') {
    app.use(morgan('dev'))
  }
  app.use(requestLogger)

  // Health check (no session — kept reachable even when DB is down)
  app.use('/health', healthRouter)

  // Session middleware — runs before any /api/* route that needs req.userId.
  // We skip /health (above) and /api/ai/* (it is IP-based, not user-based,
  // and we don't want to force a DB write on every AI request).
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/health') || req.path.startsWith('/api/ai')) {
      next()
      return
    }
    void sessionMiddleware(req, res, next)
  })

  // API routes
  app.use('/api/ai', aiRouter)                  // Task B4 — IP-based rate limit
  app.use('/api/records', recordsRouter)         // Task B5
  app.use('/api/favorites', favoritesRouter)     // Task B5
  // app.use('/api/auth', authRouter)            // Task B3

  // 404 + error handlers (must be last)
  app.use(notFound)
  app.use(errorHandler)

  return app
}
