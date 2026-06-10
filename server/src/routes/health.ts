import { Router } from 'express'
import { isDatabaseHealthy } from '../db/health.js'

export const healthRouter = Router()

healthRouter.get('/', async (_req, res) => {
  const dbHealthy = await isDatabaseHealthy()
  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: process.env.NODE_ENV ?? 'development',
    checks: {
      database: dbHealthy ? 'up' : 'down',
    },
  })
})
