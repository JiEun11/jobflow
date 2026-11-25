import { isNeonUrl, neonConnectionString } from '@jobflow/db/neon'

export function webEnvironment(env = process.env) {
  if (env.VERCEL_ENV === 'preview') throw new Error('Preview has no database access.')
  const cloud = env.VERCEL_ENV === 'production'
  if (env.VERCEL === '1' && !cloud && env.VERCEL_ENV !== 'development') {
    throw new Error('Unsupported hosted environment.')
  }
  if (!cloud && isNeonUrl(env.DATABASE_URL)) throw new Error('Neon access is restricted to production.')
  const rawOrigin = env.JOBFLOW_APP_URL ?? (cloud ? '' : 'http://127.0.0.1:3000')
  const origin = URL.parse(rawOrigin)
  if (!origin || origin.username || origin.password || origin.pathname !== '/' ||
      origin.search || origin.hash || (cloud
        ? origin.protocol !== 'https:' || origin.port !== '' || !origin.hostname.includes('.') ||
          origin.hostname.endsWith('.localhost') || origin.hostname.endsWith('.local') ||
          /^(?:[\d.]+|\[.*\])$/.test(origin.hostname)
        : origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1')) {
    throw new Error('JOBFLOW_APP_URL must be a canonical application origin.')
  }
  if (cloud) neonConnectionString(env.DATABASE_URL, 'pooled', 'jobflow_web')
  const secret = env.BETTER_AUTH_SECRET
  if (!secret || secret.length < 32 || (cloud && new Set(secret).size < 12)) {
    throw new Error('A strong BETTER_AUTH_SECRET is required.')
  }
  return { cloud, origin: origin.origin, secret }
}

export function pdfEnabled(env = process.env) {
  return env.VERCEL !== '1' && !['production', 'preview'].includes(env.VERCEL_ENV ?? '') &&
    env.JOBFLOW_DISABLE_PDF !== '1'
}
