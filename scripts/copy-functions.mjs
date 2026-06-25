/**
 * Copy the project-root `functions/` directory into `dist/functions/`
 * after `vite build` runs.
 *
 * Cloudflare Pages auto-detects Functions when a `functions/` folder
 * exists at the deploy root. The deploy root is whatever directory
 * we point Cloudflare at — in our case `dist/`. So we have to copy
 * the Functions source there before the Pages build uploads the
 * artifact.
 *
 * This is run as the postbuild step of `npm run build`.
 */

import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const src = resolve(root, 'functions')
const dst = resolve(root, 'dist', 'functions')

if (!existsSync(src)) {
  console.log('[copy-functions] no functions/ at project root, skipping')
  process.exit(0)
}

// Clean prior run so removed functions don't linger.
if (existsSync(dst)) {
  rmSync(dst, { recursive: true, force: true })
}

cpSync(src, dst, { recursive: true, filter: (p) => !p.includes('node_modules') })
console.log(`[copy-functions] mirrored ${src} → ${dst}`)