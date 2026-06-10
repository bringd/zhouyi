import type { Request, Response, NextFunction } from 'express'

/**
 * Centralized error handler. Catches anything passed to next(err)
 * or thrown synchronously / in async handlers.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) {
  console.error('[error]', err)

  // Zod errors
  if (err.name === 'ZodError') {
    res.status(400).json({
      error: 'ValidationError',
      details: JSON.parse(err.message),
    })
    return
  }

  // Default to 500
  res.status(500).json({
    error: 'InternalServerError',
    message:
      process.env.NODE_ENV === 'production'
        ? 'An internal error occurred'
        : err.message,
  })
}
