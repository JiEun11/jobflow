import { listResumes } from '@jobflow/db/resumes'
import { json, route } from '../../../server/http'
import { uploadResume } from '../../../server/resumes'
import { pdfEnabled } from '../../../server/environment'

export const GET = route(async (_request, principal) =>
  pdfEnabled() ? json(await listResumes(principal)) : json({}, 404))
export const POST = route(async (request, principal) =>
  pdfEnabled() ? json(await uploadResume(request, principal), 201) : json({}, 404), true)
