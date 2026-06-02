import type { Request, Response, NextFunction } from 'express'

/**
 * Simple structured request logger.
 * Adds a per-request id and timing info.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()
  const id = Math.random().toString(36).slice(2, 11)
  res.setHeader('X-Request-Id', id)

  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(
      `[${id}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${duration}ms)`
    )
  })

  next()
}
