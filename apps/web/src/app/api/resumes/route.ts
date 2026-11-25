import { listResumes } from '@jobflow/db/resumes'
import { json, route } from '../../../server/http'
import { uploadResume } from '../../../server/resumes'

export const GET = route(async (_request, principal) => json(await listResumes(principal)))
export const POST = route(async (request, principal) => json(await uploadResume(request, principal), 201), true)
