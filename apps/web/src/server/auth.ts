import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'
import { database } from '@jobflow/db/client'
import * as schema from '@jobflow/db/schema'

export function appOrigin() {
  const url = new URL(process.env.JOBFLOW_APP_URL ?? 'http://127.0.0.1:3000')
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') {
    throw new Error('JOBFLOW_APP_URL must use the local IPv4 loopback address.')
  }
  return url.origin
}

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error('A strong BETTER_AUTH_SECRET is required.')
  const baseURL = appOrigin()
  return betterAuth({
    database: drizzleAdapter(database(), { provider: 'pg', schema }),
    appName: 'Jobflow',
    baseURL,
    secret,
    trustedOrigins: [baseURL],
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 14, maxPasswordLength: 128 },
    session: { cookieCache: { enabled: false } },
    rateLimit: { enabled: true, window: 60, max: 20 },
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
  const session = await authServer().api.getSession({ headers })
  return session && await isOwner(session.user.id) ? session.user.id : null
}
