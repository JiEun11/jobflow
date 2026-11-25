import { connectDatabase } from './client.ts'
import { collect } from './collector.ts'
import { neonConnectionString } from './neon.ts'

async function run() {
  if (process.env.JOBFLOW_COLLECTOR_ENABLED !== 'true') throw new Error('Collector is disabled.')
  const trigger = process.env.JOBFLOW_COLLECTION_TRIGGER
  if (trigger !== 'schedule' && trigger !== 'manual') throw new Error('Invalid trigger.')
  const { db, pool } = connectDatabase(neonConnectionString(process.env.DATABASE_URL, 'pooled', 'jobflow_collector'), 1)
  try {
    const result = await collect(db, {
      boards: process.env.JOBFLOW_GREENHOUSE_BOARDS ?? '', trigger, day: process.env.JOBFLOW_COLLECTION_DATE,
    })
    console.log('Collection status: ' + result)
    if (result !== 'success' && result !== 'already_collected') process.exitCode = 1
  } finally {
    await pool.end()
  }
}

try {
  await run()
} catch {
  console.error('Collector failed. Check configuration and the database run log.')
  process.exitCode = 1
}
