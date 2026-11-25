import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { connectDatabase } from './client.ts'
import { isNeonUrl, neonConnectionString } from './neon.ts'

const cloud = process.argv.includes('--cloud')
if (!cloud && isNeonUrl(process.env.DATABASE_URL)) throw new Error('Use the approved cloud migration command.')
if (cloud && (!process.stdin.isTTY || process.env.JOBFLOW_APPROVE_CLOUD_MIGRATION !== '1')) {
  throw new Error('Use an approved interactive cloud migration session.')
}
const { db, pool } = cloud
  ? connectDatabase(neonConnectionString(process.env.JOBFLOW_ADMIN_DATABASE_URL, 'direct'), 1)
  : connectDatabase()
try {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../migrations', import.meta.url)) })
  console.log('Database migrations applied.')
} catch {
  console.error('Database migration failed. Check the connection and schema permissions.')
  process.exitCode = 1
} finally {
  await pool.end()
}
