import type { MiddlewareHandler } from 'hono'

/**
 * CORS middleware.
 *
 * The Pages frontend (https://orix-studio.pages.dev) calls this
 * Worker cross-origin. Browsers send a preflight OPTIONS that we
 * must answer before the actual POST/GET.
 *
 * `FRONTEND_ORIGIN` is read from the Worker's `vars` (set in
 * wrangler.toml) so the dev / staging / production URLs are
 * different without code changes.
 *
 * We also handle non-preflight CORS by echoing the origin and the
 * methods/headers we expose.
 */
export const corsMiddleware: MiddlewareHandler = async (c, next) => {
  const allowed = c.env.FRONTEND_ORIGIN ?? 'https://orix-studio.pages.dev'
  const origin = c.req.header('origin') ?? ''
  const isAllowed = origin === allowed

  // Always echo back the matching origin (or '*' for credentials)
  const allowOrigin = isAllowed ? origin : allowed
  c.header('Access-Control-Allow-Origin', allowOrigin)
  c.header('Vary', 'Origin')
  c.header('Access-Control-Allow-Credentials', 'true')
  c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  c.header('Access-Control-Max-Age', '86400')

  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204)
  }
  await next()
}
