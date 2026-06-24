import { z } from 'zod'
import 'dotenv/config'

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  /**
   * Comma-separated list of allowed CORS origins. Use this to grant the
   * preview / dev / production frontend hosts access to the API in a single
   * env var. Example:
   *   FRONTEND_ORIGIN=http://localhost:5173,http://localhost:4173
   */
  FRONTEND_ORIGIN: z
    .string()
    .default('http://localhost:5173,http://localhost:4173,http://localhost:4180,http://localhost:4181'),
  // Database (will be used in Task B2)
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/zhouyi'),
  // Auth (will be used in Task B3)
  JWT_SECRET: z.string().default('dev-secret-change-me-in-production-please-32-chars'),
  // AI (Task B4) — defaults assume a 3rd-party Anthropic-compatible endpoint
  // (e.g. MiniMax). For direct Anthropic API usage, set ANTHROPIC_BASE_URL
  // to the Anthropic endpoint and ANTHROPIC_MODEL to a real Claude model ID.
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_AUTH_TOKEN: z.string().optional(),
  ANTHROPIC_BASE_URL: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('MiniMax-M3'),
})

const parsed = configSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format())
  process.exit(1)
}

const raw = parsed.data

// Resolve the effective API key — accept either of the two env var names
// that the Anthropic SDK and MiniMax both recognize. ANTHROPIC_AUTH_TOKEN
// takes precedence (the name MiniMax's CLI/SDK ecosystem uses).
const resolvedApiKey = raw.ANTHROPIC_AUTH_TOKEN || raw.ANTHROPIC_API_KEY

export const config = {
  ...raw,
  ANTHROPIC_API_KEY: resolvedApiKey,
  ANTHROPIC_AUTH_TOKEN: undefined, // do not leak the raw alias to consumers
  FRONTEND_ORIGIN_LIST: raw.FRONTEND_ORIGIN.split(',')
    .map((s) => s.trim())
    .filter(Boolean),
}
