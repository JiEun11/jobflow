import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'
import { database } from '@jobflow/db/client'
import * as schema from '@jobflow/db/schema'
import { webEnvironment } from './environment'

export function appOrigin() {
  return webEnvironment().origin
}

function createAuth() {
  const { origin: baseURL, secret, cloud } = webEnvironment()
  return betterAuth({
    database: drizzleAdapter(database(), { provider: 'pg', schema }),
    appName: 'Jobflow',
    baseURL,
    secret,
    trustedOrigins: [baseURL],
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 14, maxPasswordLength: 128 },
    session: { cookieCache: { enabled: false } },
    rateLimit: { enabled: true, window: 60, max: 20, storage: 'database' },
    advanced: cloud ? {
      useSecureCookies: true, ipAddress: { ipAddressHeaders: ['x-vercel-forwarded-for'] },
    } : undefined,
    databaseHooks: {
      session: { create: { before: async ({ userId }) => await isOwner(userId) ? undefined : false } },
    },
    logger: { disabled: true },
  })
}

let auth: ReturnType<typeof createAuth> | undefined
export function authServer() {
  auth ??= createAuth()
  return auth
}

async function isOwner(userId: string) {
  const [owner] = await database().select({ id: schema.owner.userId }).from(schema.owner)
    .where(eq(schema.owner.userId, userId))
  return Boolean(owner)
}

export async function ownerId(headers: Headers) {
  if (process.env.VERCEL_ENV === 'preview') return null
  const session = await authServer().api.getSession({ headers })
  return session && await isOwner(session.user.id) ? session.user.id : null
}
