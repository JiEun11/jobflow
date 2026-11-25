import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { database } from './client.ts'
import { collectionRun, job, jobSnapshot } from './schema.ts'

const latest = and(eq(job.id, jobSnapshot.jobId), eq(job.revision, jobSnapshot.revision))

export async function jobsOverview() {
  const db = database()
  const [[run], [success], jobs] = await Promise.all([
    db.select({
      status: collectionRun.status, startedAt: collectionRun.startedAt, finishedAt: collectionRun.finishedAt,
      expired: sql<boolean>`${collectionRun.status} = 'running' and ${collectionRun.leaseUntil} <= now()`,
    }).from(collectionRun).orderBy(desc(collectionRun.startedAt)).limit(1),
    db.select({ at: collectionRun.finishedAt }).from(collectionRun)
      .where(eq(collectionRun.status, 'success')).orderBy(desc(collectionRun.finishedAt)).limit(1),
    db.select({
      id: job.id, title: jobSnapshot.title, company: jobSnapshot.company,
      location: jobSnapshot.location, url: jobSnapshot.url, firstSeenAt: job.firstSeenAt,
    }).from(job).innerJoin(jobSnapshot, latest).where(gte(job.firstSeenAt, sql`now() - interval '14 days'`))
      .orderBy(jobSnapshot.priority, desc(job.firstSeenAt), job.id)
      .limit(30),
  ])
  return { run, lastSuccess: success?.at, jobs }
}

export async function jobDetails(id: string) {
  const [record] = await database().select({
    title: jobSnapshot.title, company: jobSnapshot.company, location: jobSnapshot.location,
    url: jobSnapshot.url, jd: jobSnapshot.jd, capturedAt: jobSnapshot.capturedAt,
  }).from(job).innerJoin(jobSnapshot, latest).where(eq(job.id, id)).limit(1)
  return record
}
