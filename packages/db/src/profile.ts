import { and, desc, eq } from 'drizzle-orm'
import type { Profile } from '@jobflow/core/profile'
import { database } from './client.ts'
import { owner, profileVersion } from './schema.ts'

const headQuery = (ownerId: string) => database().select().from(profileVersion)
  .where(eq(profileVersion.ownerId, ownerId)).orderBy(desc(profileVersion.revision)).limit(1)

export async function currentProfile(ownerId: string) {
  const [current] = await headQuery(ownerId)
  return current ?? null
}

export async function findVersion(ownerId: string, revision: number) {
  const [version] = await database().select().from(profileVersion)
    .where(and(eq(profileVersion.ownerId, ownerId), eq(profileVersion.revision, revision)))
  return version ?? null
}

export function listVersions(ownerId: string) {
  return database().select({
    revision: profileVersion.revision, createdAt: profileVersion.createdAt,
    archived: profileVersion.archived, restoredFrom: profileVersion.restoredFrom,
  }).from(profileVersion).where(eq(profileVersion.ownerId, ownerId))
    .orderBy(desc(profileVersion.revision))
}

type Change = { kind: 'save'; profile: Profile } | { kind: 'archive' } | { kind: 'restore'; revision: number }

export async function changeProfile(ownerId: string, expectedRevision: number, change: Change) {
  return database().transaction(async (tx) => {
    const [principal] = await tx.select().from(owner).where(eq(owner.userId, ownerId)).for('update')
    if (!principal) return { status: 403 as const }
    const [current] = await tx.select().from(profileVersion)
      .where(eq(profileVersion.ownerId, ownerId)).orderBy(desc(profileVersion.revision)).limit(1)
    if ((current?.revision ?? 0) !== expectedRevision) return { status: 409 as const }
    let profile: Profile
    if (change.kind === 'save') {
      profile = change.profile
    } else if (change.kind === 'archive') {
      if (!current || current.archived) return { status: 404 as const }
      profile = current
    } else {
      const [source] = await tx.select().from(profileVersion).where(and(
        eq(profileVersion.ownerId, ownerId), eq(profileVersion.revision, change.revision),
      ))
      if (!source || source.archived) return { status: 404 as const }
      profile = source
    }
    const { personal, experiences, skills, projects, education, preferences } = profile
    const revision = expectedRevision + 1
    await tx.insert(profileVersion).values({
      ownerId, revision, personal, experiences, skills, projects, education, preferences,
      archived: change.kind === 'archive',
      restoredFrom: change.kind === 'restore' ? change.revision : null,
    })
    return { status: 200 as const, revision }
  })
}
