import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { database } from './client.ts'
import { owner, resume } from './schema.ts'

const owned = (ownerId: string, id: string) => and(eq(resume.ownerId, ownerId), eq(resume.id, id))

export function listResumes(ownerId: string) {
  return database().select({
    id: resume.id, filename: resume.filename, byteSize: resume.byteSize, createdAt: resume.createdAt,
    deleting: sql<boolean>`${resume.deletionRequestedAt} is not null`,
  }).from(resume).where(eq(resume.ownerId, ownerId)).orderBy(desc(resume.createdAt))
}

export async function findResume(ownerId: string, id: string) {
  const [record] = await database().select().from(resume)
    .where(and(owned(ownerId, id), isNull(resume.deletionRequestedAt)))
  return record
}

export async function storeResume(record: typeof resume.$inferInsert, write: () => Promise<void>) {
  await database().transaction(async (tx) => {
    const [principal] = await tx.select().from(owner).where(eq(owner.userId, record.ownerId)).for('update')
    if (!principal) throw new Error('Owner authorization failed.')
    await tx.insert(resume).values(record)
    await write()
  })
}

export async function markResumeForDeletion(ownerId: string, id: string) {
  const [record] = await database().update(resume)
    .set({ deletionRequestedAt: sql`coalesce(${resume.deletionRequestedAt}, now())` })
    .where(owned(ownerId, id)).returning({ id: resume.id })
  return Boolean(record)
}

export async function finishResumeDeletion(ownerId: string, id: string) {
  await database().delete(resume).where(owned(ownerId, id))
}
