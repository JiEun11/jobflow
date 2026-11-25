import Link from 'next/link'
import { jobsOverview } from '@jobflow/db/jobs'
import { localDate } from '../format'

const labels = { running: 'Running', success: 'Succeeded', partial: 'Partially failed', failed: 'Failed' }

export async function JobsPanel() {
  const { run, lastSuccess, jobs } = await jobsOverview()
  const time = run?.finishedAt ?? run?.startedAt
  const status = run ? run.expired ? 'Interrupted' : labels[run.status] : 'No runs recorded'
  return <section id="jobs" className="panel grid gap-4" aria-labelledby="jobs-title">
    <div>
      <h2 id="jobs-title">New jobs</h2>
      <p className="mt-1 text-sm text-muted">Latest collection: {status}{time && ' · ' + localDate(time.toISOString())}</p>
      {lastSuccess && <p className="text-sm text-muted">Last successful collection: {localDate(lastSuccess.toISOString())}</p>}
    </div>
    {jobs.length === 0 ? <p className="text-sm text-muted">No matching jobs collected in the last 14 days.</p> :
      <ul className="divide-y divide-line">
        {jobs.map((job) => <li className="grid gap-1 py-3 first:pt-0" key={job.id}>
          <Link className="text-link w-fit break-words" href={'/jobs/' + job.id}>{job.title}</Link>
          <p className="text-sm">{job.company} · {job.location || 'Remote, Canada'}</p>
          <a className="text-sm text-accent underline w-fit" href={job.url} rel="noreferrer">Original posting</a>
        </li>)}
      </ul>}
  </section>
}
