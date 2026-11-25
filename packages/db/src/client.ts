import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

export function connectDatabase() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required.')
  const pool = new pg.Pool({ connectionString })
  pool.on('error', () => console.error('Idle database connection failed.'))
  return { db: drizzle(pool, { logger: false }), pool }
}

let connection: ReturnType<typeof connectDatabase> | undefined
export function database() {
  connection ??= connectDatabase()
  return connection.db
}
