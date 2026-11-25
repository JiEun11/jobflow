import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { isNeonUrl } from './neon.ts'

export function connectDatabase(connectionString = process.env.DATABASE_URL, max = 2) {
  if (!connectionString) throw new Error('DATABASE_URL is required.')
  const pool = new pg.Pool({
    connectionString, max, connectionTimeoutMillis: 7_000,
    idleTimeoutMillis: 5_000, allowExitOnIdle: true, enableChannelBinding: isNeonUrl(connectionString),
  })
  pool.on('error', () => console.error('Idle database connection failed.'))
  return { db: drizzle(pool, { logger: false }), pool }
}

let connection: ReturnType<typeof connectDatabase> | undefined
export function database() {
  connection ??= connectDatabase()
  return connection.db
}
