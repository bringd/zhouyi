import express, { type Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { config } from './config.js'
import { requestLogger } from './middleware/requestLogger.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import { healthRouter } from './routes/health.js'

/**
 * Express app factory. Separated from index.ts so tests can import
 * the app without triggering listen().
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

  // Logging
  if (config.NODE_ENV !== 'test') {
    app.use(morgan('dev'))
  }
  app.use(requestLogger)

  // Health check (no auth)
  app.use('/health', healthRouter)

  // TODO: API routes will be added in later tasks
  // app.use('/api/auth', authRouter)         // Task B3
  // app.use('/api/ai', aiRouter)             // Task B4
  // app.use('/api/records', recordsRouter)   // Task B5

  // 404 + error handlers (must be last)
  app.use(notFound)
  app.use(errorHandler)

  return app
}
