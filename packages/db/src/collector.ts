import { createHash } from 'node:crypto'
import { and, eq, gt, lte, sql } from 'drizzle-orm'
import type { CollectedJob } from '@jobflow/core/greenhouse'
import { type connectDatabase } from './client.ts'
import { approvedBoards, fetchGreenhouseBoard, type BoardResult } from './greenhouse.ts'
import { collectionAttempt, collectionBoard, collectionRun, job, jobSnapshot } from './schema.ts'

type Db = ReturnType<typeof connectDatabase>['db']
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type Trigger = 'schedule' | 'manual'
type Claim = { day: string; attempt: number }

export function seoulDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  return ['year', 'month', 'day'].map((part) => parts.find(({ type }) => type === part)?.value).join('-')
}

export function collectionDay(input: string | undefined, trigger: Trigger, now = new Date()) {
  const today = seoulDay(now)
  // 00:00 UTC and 09:00 Seoul have the same calendar date. This keeps the
  // original key if a scheduled run arrives after Seoul midnight but before 09:00.
  if (!input) return trigger === 'schedule' ? now.toISOString().slice(0, 10) : today
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input) ? new Date(input + 'T00:00:00Z') : null
  if (trigger !== 'manual' || !date || !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== input || input > today || input < '2000-01-01') {
    throw new Error('Use a valid past or present Seoul date for manual replay.')
  }
  return input
}

async function claimRun(db: Db, day: string, trigger: Trigger) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(368092585028)`)
    const expired = await tx.update(collectionRun).set({
      status: 'failed', finishedAt: sql`now()`,
    }).where(and(eq(collectionRun.status, 'running'), lte(collectionRun.leaseUntil, sql`now()`)))
      .returning({ day: collectionRun.day, attempt: collectionRun.attempt })
    for (const run of expired) {
      await tx.update(collectionAttempt).set({
        status: 'failed', finishedAt: sql`now()`, error: 'lease_expired',
      }).where(attemptKey(run))
    }

    const [current] = await tx.select().from(collectionRun).where(eq(collectionRun.day, day))
    if (current?.status === 'success') return 'already_collected' as const
    const [active] = await tx.select({ day: collectionRun.day }).from(collectionRun)
      .where(eq(collectionRun.status, 'running')).limit(1)
    if (active) return 'busy' as const

    const next = {
      day, attempt: (current?.attempt ?? 0) + 1, status: 'running' as const,
      startedAt: sql`now()`, finishedAt: null, leaseUntil: sql`now() + interval '10 minutes'`,
    }
    await tx.insert(collectionRun).values(next).onConflictDoUpdate({ target: collectionRun.day, set: next })
    await tx.insert(collectionAttempt).values({
      day, attempt: next.attempt, trigger, startedAt: sql`now()`, status: 'running',
    })
    return { day, attempt: next.attempt }
  })
}

const attemptKey = ({ day, attempt }: Claim) => and(
  eq(collectionAttempt.day, day), eq(collectionAttempt.attempt, attempt),
)

async function assertLease(tx: Tx, claim: Claim) {
  const [active] = await tx.select({ day: collectionRun.day }).from(collectionRun).where(and(
    eq(collectionRun.day, claim.day), eq(collectionRun.attempt, claim.attempt),
    eq(collectionRun.status, 'running'), gt(collectionRun.leaseUntil, sql`clock_timestamp()`),
  )).for('update')
  if (!active) throw new Error('Collector lease no longer held.')
}

async function storePosting(tx: Tx, board: string, company: string, posting: CollectedJob) {
  const identity = { provider: 'greenhouse', board, externalId: posting.externalId }
  const [created] = await tx.insert(job).values({
    ...identity, revision: 0, firstSeenAt: sql`now()`, lastSeenAt: sql`now()`,
  }).onConflictDoNothing({ target: [job.provider, job.board, job.externalId] }).returning({ id: job.id })
  const [record] = await tx.select({ id: job.id, revision: job.revision }).from(job).where(and(
    eq(job.provider, identity.provider), eq(job.board, board), eq(job.externalId, posting.externalId),
  )).for('update')
  if (!record) throw new Error('Posting identity unavailable.')
  const { title, location, url, jd, priority } = posting
  const digest = createHash('sha256').update(JSON.stringify([title, company, location, url, jd, priority])).digest('hex')
  const [last] = await tx.select({ digest: jobSnapshot.digest }).from(jobSnapshot)
    .where(and(eq(jobSnapshot.jobId, record.id), eq(jobSnapshot.revision, record.revision)))
  const revised = digest !== last?.digest
  const revision = record.revision + Number(revised)
  if (revised) {
    await tx.insert(jobSnapshot).values({
      jobId: record.id, revision, digest, title, company, location, url, jd, priority, capturedAt: sql`now()`,
    })
  }
  await tx.update(job).set({ revision, lastSeenAt: sql`now()` }).where(eq(job.id, record.id))
  return { added: Number(Boolean(created)), revised: Number(revised && !created) }
}

async function recordBoard(db: Db, claim: Claim, result: BoardResult, company: string) {
  await db.transaction(async (tx) => {
    await assertLease(tx, claim)
    let added = 0
    let revised = 0
    if ('jobs' in result) {
      for (const posting of result.jobs) {
        const change = await storePosting(tx, result.board, company, posting)
        added += change.added
        revised += change.revised
      }
    }
    await tx.insert(collectionBoard).values({
      ...claim, board: result.board, status: 'jobs' in result ? 'success' : 'failed',
      httpAttempts: result.attempts, added, revised,
      matched: 'jobs' in result ? result.jobs.length : 0, error: 'error' in result ? result.error : null,
    })
  })
}

async function finish(db: Db, claim: Claim, status: 'success' | 'partial' | 'failed', error?: string) {
  await db.transaction(async (tx) => {
    await assertLease(tx, claim)
    const result = { status, finishedAt: sql`now()` }
    await tx.update(collectionRun).set(result).where(eq(collectionRun.day, claim.day))
    await tx.update(collectionAttempt).set({ ...result, error }).where(attemptKey(claim))
  })
}

export async function collect(db: Db, options: {
  boards: string; trigger: Trigger; day?: string; request?: typeof fetch;
}) {
  const boards = approvedBoards(options.boards)
  const day = collectionDay(options.day, options.trigger)
  const claim = await claimRun(db, day, options.trigger)
  if (typeof claim === 'string') return claim

  let passed = 0
  try {
    for (const { token, company } of boards) {
      const result = await fetchGreenhouseBoard(token, options.request)
      await recordBoard(db, claim, result, company)
      if ('jobs' in result) passed++
    }
    const status = passed === boards.length ? 'success' : passed > 0 ? 'partial' : 'failed'
    await finish(db, claim, status)
    return status
  } catch {
    await finish(db, claim, 'failed', 'collector_error').catch(() => {})
    throw new Error('Collector failed to persist or finalize the run.')
  }
}
