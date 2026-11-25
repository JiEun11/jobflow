import Link from 'next/link'
import { notFound } from 'next/navigation'
import { jobDetails } from '@jobflow/db/jobs'
import { localDate } from '../../../../features/format'
import { pageOwner } from '../../../../server/page-owner'

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  await pageOwner()
  const { id } = await params
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) notFound()
  const job = await jobDetails(id)
  if (!job) notFound()
  return <article className="panel grid gap-4">
    <Link className="text-link w-fit" href="/#jobs">Back to jobs</Link>
    <h1 className="break-words">{job.title}</h1>
    <p>{job.company} · {job.location || 'Remote, Canada'}</p>
    <p className="text-sm text-muted">JD captured {localDate(job.capturedAt.toISOString())}</p>
    <a className="text-link w-fit" href={job.url} rel="noreferrer">Original posting</a>
    <h2>Job description</h2>
    <p className="whitespace-pre-wrap break-words">{job.jd}</p>
  </article>
}
