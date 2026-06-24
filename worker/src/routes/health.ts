import { Hono } from 'hono'

/** Health check (no DB hit, just returns liveness + version). */
export const healthRouter = new Hono()

healthRouter.get('/', (c) =>
  c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }),
)
