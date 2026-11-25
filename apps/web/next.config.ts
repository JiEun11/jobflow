import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import type { NextConfig } from 'next'

const workspace = fileURLToPath(new URL('../..', import.meta.url))
try {
  loadEnvFile(new URL('../../.env', import.meta.url))
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
}
const config: NextConfig = {
  turbopack: { root: workspace },
  poweredByHeader: false,
}
export default config
