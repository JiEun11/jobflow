import { currentProfile, findVersion, listVersions } from '@jobflow/db/profile'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Editor } from '../../../features/profile/editor'
import { pageOwner } from '../../../server/page-owner'

export const metadata = { title: 'Career profile' }

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  const principal = await pageOwner()
  const [current, versions] = await Promise.all([currentProfile(principal), listVersions(principal)])
  const revision = current?.revision ?? 0
  const { version } = await searchParams
  const requested = Number(version)
  const viewingHistory = version !== undefined
  if (viewingHistory && (!Number.isInteger(requested) || requested < 1 || requested > 2147483647)) notFound()
  const active = viewingHistory ? await findVersion(principal, requested) : current?.archived ? null : current
  if (viewingHistory && !active) notFound()
  return <div className="mx-auto grid max-w-4xl gap-5">
    <header className="grid gap-2">
      <h1>Master Career Profile</h1>
      <p className="text-sm text-muted">{viewingHistory ? 'Viewing version ' + requested : active ? 'Current version ' + revision : current ? 'Archived' : 'Not started'}</p>
    </header>
    {viewingHistory && <Link className="text-link" href="/profile">Back to current profile</Link>}
    <Editor key={viewingHistory ? 'history-' + requested : revision} readOnly={viewingHistory} revision={revision} archived={current?.archived ?? false}
      initial={active && { personal: active.personal, experiences: active.experiences, skills: active.skills,
        projects: active.projects, education: active.education, preferences: active.preferences }}
      versions={versions.map((version) => ({ ...version, createdAt: version.createdAt.toISOString() }))} />
  </div>
}
