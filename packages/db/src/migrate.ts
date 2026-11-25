import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { connectDatabase } from './client.ts'

const { db, pool } = connectDatabase()
try {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)) })
  console.log('Database migrations applied.')
} catch {
  console.error('Database migration failed. Check the local connection and schema permissions.')
  process.exitCode = 1
} finally {
  await pool.end()
}
