'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { localDate } from '../format'

type Resume = { id: string; filename: string; byteSize: number; createdAt: string; deleting: boolean }

export function ResumePanel({ resumes }: { resumes: Resume[] }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function run(request: () => Promise<Response>, success: () => void) {
    setPending(true)
    setError('')
    setNotice('')
    try {
      const response = await request()
      if (!response.ok) {
        const body = await response.json() as { error?: string }
        setError(body.error ?? 'The request failed.')
        router.refresh()
        return
      }
      success()
      router.refresh()
    } catch {
      setError('The request failed. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const file = new FormData(form).get('resume')
    if (!(file instanceof File) || !file.size) return setError('Choose a PDF.')
    if (file.size > 5 * 1024 * 1024) return setError('Choose a PDF under 5 MiB.')
    await run(() => fetch('/api/resumes', {
      method: 'POST', body: file,
      headers: { 'Content-Type': 'application/pdf', 'X-Jobflow-Filename': encodeURIComponent(file.name) },
    }), () => { form.reset(); setNotice('Resume uploaded.') })
  }

  return <section className="panel" aria-labelledby="resumes">
    <h2 id="resumes">Resumes</h2>
    <form className="mt-4 flex flex-wrap items-end gap-3" method="post" action="/api/resumes"
      encType="multipart/form-data" onSubmit={upload}>
      <label className="min-w-0 flex-1">
        PDF file (up to 5 MiB)
        <input name="resume" type="file" accept=".pdf,application/pdf" required disabled={pending} />
      </label>
      <button className="button" disabled={pending}>Upload PDF</button>
    </form>
    {error && <p className="message mt-3" role="alert">{error}</p>}
    {notice && <p className="mt-3 text-sm text-emerald-800" role="status">{notice}</p>}
    {resumes.length === 0 ? <p className="mt-5 text-sm text-muted">No resumes uploaded.</p> :
      <ul className="mt-4 divide-y divide-line">
        {resumes.map((file) => <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="break-all font-medium">{file.filename}</p>
            <p className="text-sm text-muted">{Math.ceil(file.byteSize / 1024)} KiB · {localDate(file.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!file.deleting && <a className="text-link" href={'/api/resumes/' + file.id}>Download</a>}
            <button className="danger" disabled={pending} onClick={() => {
              if (!file.deleting && !window.confirm('Permanently delete this resume?')) return
              void run(() => fetch('/api/resumes/' + file.id, { method: 'DELETE' }), () => setNotice('Resume removed.'))
            }}>{file.deleting ? 'Retry deletion' : 'Delete'}</button>
          </div>
        </li>)}
      </ul>}
  </section>
}
