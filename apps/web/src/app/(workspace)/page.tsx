import Link from 'next/link'
import { preferencesDefaults } from '@jobflow/core/profile'
import { currentProfile } from '@jobflow/db/profile'
import { listResumes } from '@jobflow/db/resumes'
import { localDate } from '../../features/format'
import { ResumePanel } from '../../features/resumes/resume-panel'
import { pageOwner } from '../../server/page-owner'

export default async function Today() {
  const principal = await pageOwner()
  const [saved, resumes] = await Promise.all([currentProfile(principal), listResumes(principal)])
  const profile = saved?.archived ? null : saved
  const preferences = profile?.preferences ?? preferencesDefaults
  return <div className="grid gap-5">
    <header><h1>Today</h1></header>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="panel grid content-start gap-3">
        <h2>Master Career Profile</h2>
        <p className="text-sm text-muted">{profile ? 'Saved · Version ' + profile.revision : saved ? 'Archived' : 'Not started'}</p>
        {saved && <p className="text-sm text-muted">Last modified {localDate(saved.createdAt.toISOString())}</p>}
        {profile && <>
          <h3>Work experience</h3>
          <ul className="grid gap-1">
            {profile.experiences.map((item) => <li className="break-words text-sm" key={item.id}>{item.title} · {item.company}</li>)}
            {profile.experiences.length === 0 && <li className="text-sm text-muted">No experience added.</li>}
          </ul>
          <h3>Technical skills</h3>
          <p className="break-words text-sm">{profile.skills.map((skill) => skill.name).join(', ') || 'No skills added.'}</p>
        </>}
        <Link className="button mt-2" href="/profile">{profile ? 'Edit profile' : 'Open profile'}</Link>
      </section>
      <section className="panel">
        <h2>Job search preferences</h2>
        <dl className="mt-4 grid gap-3 break-words text-sm">
          <div><dt className="text-muted">Country</dt><dd>{preferences.country}</dd></div>
          <div><dt className="text-muted">Priority location</dt><dd>{preferences.priorityLocation || 'Any'}</dd></div>
          <div><dt className="text-muted">Roles</dt><dd>{preferences.roles.join(', ')}</dd></div>
          <div><dt className="text-muted">Planned daily collection</dt><dd>{preferences.collectionTime} {preferences.timezone} · Inactive</dd></div>
        </dl>
      </section>
    </div>
    <ResumePanel resumes={resumes.map((resume) => ({ ...resume, createdAt: resume.createdAt.toISOString() }))} />
  </div>
}
