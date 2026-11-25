'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { blankProfile, type Profile } from '@jobflow/core/profile'
import { localDate } from '../format'

type Version = { revision: number; createdAt: string; archived: boolean; restoredFrom: number | null }
type Evidence = { outcome: string; source: string }
type EntryLinks = { skillIds: string[]; evidence: Evidence[] }

function Field({ label, value, change, required = false, type = 'text', limit = 200 }:
  { label: string; value: string; change: (value: string) => void; required?: boolean; type?: string; limit?: number }) {
  return <label>{label}<input type={type} value={value} onChange={(event) => change(event.target.value)}
    required={required} maxLength={limit} /></label>
}

function Notes({ label, value, change }: { label: string; value: string; change: (value: string) => void }) {
  return <label>{label}<textarea value={value} maxLength={2000} onChange={(event) => change(event.target.value)} /></label>
}

function Section({ title, children, add, addLabel }: {
  title: string; children: React.ReactNode; add?: () => void; addLabel?: string
}) {
  return <section className="panel grid gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2>{title}</h2>
      {add && <button className="secondary" type="button" onClick={add}>{addLabel}</button>}
    </div>
    {children}
  </section>
}

function Entry({ title, children, remove }: { title: string; children: React.ReactNode; remove: () => void }) {
  return <fieldset className="grid min-w-0 gap-3 rounded-xl border border-line p-4">
    <legend className="px-1 font-semibold">{title}</legend>
    {children}
    <button className="danger" type="button" onClick={remove}>Remove entry</button>
  </fieldset>
}

function Links({ entry, skills, change }: { entry: EntryLinks; skills: Profile['skills']; change: (entry: EntryLinks) => void }) {
  return <div className="grid gap-3">
    <fieldset className="min-w-0">
      <legend className="mb-1 text-sm font-semibold">Linked skills</legend>
      {skills.length === 0 ? <p className="text-sm text-muted">Add a technical skill to link it here.</p> :
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {skills.map((skill) => <label className="flex min-w-0 items-center gap-2 break-all" key={skill.id}>
            <input type="checkbox" checked={entry.skillIds.includes(skill.id)} onChange={(event) => {
              const skillIds = event.target.checked ? [...entry.skillIds, skill.id] :
                entry.skillIds.filter((id) => id !== skill.id)
              change({ ...entry, skillIds })
            }} />{skill.name || 'Unnamed skill'}
          </label>)}
        </div>}
    </fieldset>
    <h3 className="text-sm">Outcome evidence</h3>
    {entry.evidence.map((item, index) => <div className="grid gap-2 rounded-lg bg-slate-50 p-3" key={index}>
      <Field label="Outcome or verified metric" value={item.outcome} required change={(outcome) =>
        change({ ...entry, evidence: entry.evidence.map((other, i) => i === index ? { ...other, outcome } : other) })} />
      <Notes label="Source or supporting context" value={item.source} change={(source) =>
        change({ ...entry, evidence: entry.evidence.map((other, i) => i === index ? { ...other, source } : other) })} />
      <button className="danger" type="button" onClick={() =>
        change({ ...entry, evidence: entry.evidence.filter((_, i) => i !== index) })}>Remove evidence</button>
    </div>)}
    <button className="secondary" type="button" disabled={entry.evidence.length >= 12} onClick={() =>
      change({ ...entry, evidence: [...entry.evidence, { outcome: '', source: '' }] })}>Add evidence</button>
  </div>
}

type Collection = 'experiences' | 'skills' | 'projects' | 'education'

export function Editor({ initial, revision, archived, versions, readOnly }:
  { initial: Profile | null; revision: number; archived: boolean; versions: Version[]; readOnly: boolean }) {
  const router = useRouter()
  const [draft, setDraft] = useState(initial ?? blankProfile)
  const [roles, setRoles] = useState(draft.preferences.roles.join(', '))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function change<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function remove(key: Collection, id: string) {
    setDraft((current) => {
      if (key !== 'skills') return { ...current, [key]: current[key].filter((row) => row.id !== id) }
      const unlink = (row: EntryLinks) => row.skillIds.filter((skill) => skill !== id)
      return { ...current, skills: current.skills.filter((row) => row.id !== id),
        experiences: current.experiences.map((row) => ({ ...row, skillIds: unlink(row) })),
        projects: current.projects.map((row) => ({ ...row, skillIds: unlink(row) })),
      }
    })
  }

  async function mutate(payload: object) {
    setPending(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, expectedRevision: revision }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) {
        setError(data.error ?? 'The profile could not be updated.')
        setPending(false)
        return
      }
      setMessage('Profile updated.')
      if (readOnly) router.replace('/profile')
      else router.refresh()
    } catch {
      setError('The request failed. Try again.')
      setPending(false)
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void mutate({ kind: 'save', profile: {
      ...draft,
      preferences: { ...draft.preferences, roles: roles.split(',').map((role) => role.trim()).filter(Boolean) },
    } })
  }

  const personal = draft.personal
  const preferences = draft.preferences
  return <div className="grid gap-5">
    <form className="grid gap-5" onSubmit={save}>
      <fieldset disabled={pending || readOnly} className="grid min-w-0 gap-5">
        <Section title="Personal information">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" value={personal.name} required change={(name) => change('personal', { ...personal, name })} />
            <Field label="Contact email" type="email" value={personal.email} limit={254} change={(email) => change('personal', { ...personal, email })} />
            <Field label="Phone" type="tel" value={personal.phone} change={(phone) => change('personal', { ...personal, phone })} />
            <Field label="Current location" value={personal.location} change={(location) => change('personal', { ...personal, location })} />
          </div>
          <Notes label="Professional summary" value={personal.summary} change={(summary) => change('personal', { ...personal, summary })} />
        </Section>
        <Section title="Technical skills" addLabel="Add skill" add={draft.skills.length < 80 ? () =>
          change('skills', [...draft.skills, { id: crypto.randomUUID(), name: '', category: '' }]) : undefined}>
          {draft.skills.map((row, i) => <Entry title={'Skill ' + (i + 1)} key={row.id} remove={() => remove('skills', row.id)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Skill name" value={row.name} required change={(name) =>
                change('skills', draft.skills.map((item) => item.id === row.id ? { ...item, name } : item))} />
              <Field label="Category" value={row.category} change={(category) =>
                change('skills', draft.skills.map((item) => item.id === row.id ? { ...item, category } : item))} />
            </div>
          </Entry>)}
        </Section>
        <Section title="Work experience" addLabel="Add experience" add={draft.experiences.length < 40 ? () =>
          change('experiences', [...draft.experiences, {
            id: crypto.randomUUID(), company: '', title: '', period: '', description: '', skillIds: [], evidence: [],
          }]) : undefined}>
          {draft.experiences.map((row, i) => {
            const update = (fields: Partial<typeof row>) =>
              change('experiences', draft.experiences.map((item) => item.id === row.id ? { ...item, ...fields } : item))
            return <Entry title={'Experience ' + (i + 1)} key={row.id} remove={() => remove('experiences', row.id)}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Company" value={row.company} required change={(company) => update({ company })} />
                <Field label="Job title" value={row.title} required change={(title) => update({ title })} />
                <Field label="Period" value={row.period} change={(period) => update({ period })} />
              </div>
              <Notes label="Responsibilities" value={row.description} change={(description) => update({ description })} />
              <Links entry={row} skills={draft.skills} change={update} />
            </Entry>
          })}
        </Section>
        <Section title="Projects" addLabel="Add project" add={draft.projects.length < 40 ? () =>
          change('projects', [...draft.projects, {
            id: crypto.randomUUID(), name: '', description: '', skillIds: [], evidence: [],
          }]) : undefined}>
          {draft.projects.map((row, i) => {
            const update = (fields: Partial<typeof row>) =>
              change('projects', draft.projects.map((item) => item.id === row.id ? { ...item, ...fields } : item))
            return <Entry title={'Project ' + (i + 1)} key={row.id} remove={() => remove('projects', row.id)}>
              <Field label="Project name" value={row.name} required change={(name) => update({ name })} />
              <Notes label="Description" value={row.description} change={(description) => update({ description })} />
              <Links entry={row} skills={draft.skills} change={update} />
            </Entry>
          })}
        </Section>
        <Section title="Education" addLabel="Add education" add={draft.education.length < 25 ? () =>
          change('education', [...draft.education, { id: crypto.randomUUID(), institution: '', qualification: '', period: '' }]) : undefined}>
          {draft.education.map((row, i) => {
            const update = (fields: Partial<typeof row>) =>
              change('education', draft.education.map((item) => item.id === row.id ? { ...item, ...fields } : item))
            return <Entry title={'Education ' + (i + 1)} key={row.id} remove={() => remove('education', row.id)}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Institution" value={row.institution} required change={(institution) => update({ institution })} />
                <Field label="Qualification" value={row.qualification} required change={(qualification) => update({ qualification })} />
                <Field label="Period" value={row.period} change={(period) => update({ period })} />
              </div>
            </Entry>
          })}
        </Section>
        <Section title="Career preferences">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Country" value={preferences.country} required change={(country) => change('preferences', { ...preferences, country })} />
            <Field label="Priority location" value={preferences.priorityLocation} change={(priorityLocation) => change('preferences', { ...preferences, priorityLocation })} />
            <Field label="Target roles (comma-separated)" value={roles} required limit={2400} change={setRoles} />
            <Field label="Planned collection time" type="time" value={preferences.collectionTime} required change={(collectionTime) => change('preferences', { ...preferences, collectionTime })} />
            <Field label="Time zone (e.g. Asia/Seoul)" value={preferences.timezone} required change={(timezone) => change('preferences', { ...preferences, timezone })} />
          </div>
        </Section>
        {!readOnly && <div className="flex flex-wrap items-center gap-4">
          <button className="button">{pending ? 'Working…' : 'Save profile'}</button>
          {revision > 0 && !archived && <button className="danger" type="button" onClick={() => {
            if (window.confirm('Archive the current profile? You can restore it from history.')) void mutate({ kind: 'archive' })
          }}>Archive profile</button>}
        </div>}
      </fieldset>
    </form>
    {error && <p className="message" role="alert">{error}</p>}
    {message && <p className="text-sm text-emerald-800" role="status">{message}</p>}
    <Section title="Version history">
      {versions.length === 0 ? <p className="text-sm text-muted">Saved versions will appear here.</p> :
        <ul className="divide-y divide-line">
          {versions.map((version) => <li className="flex flex-wrap items-center justify-between gap-2 py-3" key={version.revision}>
            <div>
              <p className="font-medium">Version {version.revision}{version.archived ? ' · Archived' : ''}
                {version.restoredFrom ? ' · Restored from ' + version.restoredFrom : ''}</p>
              <p className="text-sm text-muted">{localDate(version.createdAt)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={'/profile?version=' + version.revision} className="text-link">View version {version.revision}</Link>
              {!version.archived && version.revision !== revision && <button className="secondary" disabled={pending}
              onClick={() => {
                if (window.confirm('Restore an earlier version as the current profile? Unsaved edits will be discarded.')) {
                  void mutate({ kind: 'restore', revision: version.revision })
                }
              }}>Restore version {version.revision}</button>}
            </div>
          </li>)}
        </ul>}
    </Section>
  </div>
}
