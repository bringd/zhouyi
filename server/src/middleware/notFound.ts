import type { Request, Response, NextFunction } from 'express'

export function notFound(req: Request, res: Response, _next: NextFunction) {
  res.status(404).json({
    error: 'NotFound',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  })
}
