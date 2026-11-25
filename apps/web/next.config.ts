import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'
import { webEnvironment } from './src/server/environment'

const workspace = fileURLToPath(new URL('../..', import.meta.url))
if (process.env.VERCEL_ENV === 'production') webEnvironment()
if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  try {
    loadEnvFile(new URL('../../.env', import.meta.url))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}
const config: NextConfig = {
  turbopack: { root: workspace },
  outputFileTracingRoot: workspace,
  poweredByHeader: false,
}
export default config
