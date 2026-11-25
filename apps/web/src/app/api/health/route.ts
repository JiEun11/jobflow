import { sql } from 'drizzle-orm'
import { database } from '@jobflow/db/client'
import { webEnvironment } from '../../../server/environment'

export const dynamic = 'force-dynamic'

export async function GET() {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    webEnvironment()
    await database().execute(sql`select 1 from jobflow_collection.run limit 1`)
    return Response.json({ status: 'ok' }, { headers })
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503, headers })
  }
}
