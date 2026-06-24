import type { Context } from 'hono'

/**
 * Centralised error response shape:
 *   { "error": "CodeName", "message": "human readable" }
 *
 * Hono's default error handler dumps a stack trace; this swaps it
 * for a tidy JSON body and a 500 status.
 */
export function errorHandler(err: Error, c: Context) {
  console.error('[error]', err)
  return c.json(
    {
      error: 'InternalServerError',
      message: err.message || 'Unexpected error',
    },
    500,
  )
}
