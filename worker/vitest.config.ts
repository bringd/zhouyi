import {
  defineWorkersConfig,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers/config'
import { resolve } from 'node:path'

export default defineWorkersConfig(async () => ({
  test: {
    include: ['../tests/worker/**/*.test.ts'],
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
        miniflare: {
          compatibilityFlags: ['nodejs_compat'],
          d1Databases: ['DB'],
        },
      },
    },
    provide: {
      d1Migrations: await readD1Migrations(resolve(__dirname, 'src/db/migrations')),
    },
  },
}))
