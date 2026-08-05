/**
 * Shared Cloudflare Worker Bindings type.
 *
 * Kept in a leaf module so route files and index.ts can both
 * `import type` it without introducing a runtime cycle:
 *   - index.ts declares the Hono app using Hono<{ Bindings: Env }>.
 *   - routes/*.ts reference Env on their own router generics.
 *
 * `import type` is erased at compile time, so neither side imports
 * a value from the other — only the type sits in the union.
 */

export interface Env {
  DB: D1Database;
  FRONTEND_ORIGIN?: string;
}
