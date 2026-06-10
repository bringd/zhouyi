import { z } from 'zod'
import 'dotenv/config'

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  // Database (will be used in Task B2)
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/zhouyi'),
  // Auth (will be used in Task B3)
  JWT_SECRET: z.string().default('dev-secret-change-me-in-production-please-32-chars'),
  // AI (will be used in Task B4)
  ANTHROPIC_API_KEY: z.string().optional(),
})

const parsed = configSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format())
  process.exit(1)
}

export const config = parsed.data
