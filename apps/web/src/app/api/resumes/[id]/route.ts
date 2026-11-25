import { findResume, finishResumeDeletion, markResumeForDeletion } from '@jobflow/db/resumes'
import { json, route } from '../../../../server/http'
import { attachmentName, isResumeId, loadResume, removeResume } from '../../../../server/resumes'

type Context = { params: Promise<{ id: string }> }

export function GET(request: Request, context: Context) {
  return route(async (_request, principal) => {
    const { id } = await context.params
    const record = isResumeId(id) ? await findResume(principal, id) : undefined
    if (!record) return json({ error: 'Resume unavailable.' }, 404)
    const bytes = await loadResume(record.id, record.byteSize, record.digest)
    if (!bytes) return json({ error: 'Resume file is missing or damaged.' }, 404)
    return new Response(new Uint8Array(bytes), { headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': attachmentName(record.filename),
      'Content-Length': String(bytes.byteLength),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    } })
  })(request)
}

export function DELETE(request: Request, context: Context) {
  return route(async (_request, principal) => {
    const { id } = await context.params
    if (!isResumeId(id) || !await markResumeForDeletion(principal, id)) {
      return json({ error: 'Resume unavailable.' }, 404)
    }
    await removeResume(id)
    await finishResumeDeletion(principal, id)
    return json({ deleted: true })
  }, true)(request)
}
