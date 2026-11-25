import { currentProfile, changeProfile, findVersion, listVersions } from '@jobflow/db/profile'
import { profileSchema } from '@jobflow/core/profile'
import { json, readJson, route } from '../../../server/http'

export const GET = route(async (request, owner) => {
  const snapshot = new URL(request.url).searchParams.get('version')
  const requested = Number(snapshot)
  if (snapshot !== null && (!Number.isInteger(requested) || requested < 1 || requested > 2147483647)) {
    return json({ error: 'Invalid profile revision.' }, 400)
  }
  const [profile, versions] = await Promise.all([
    snapshot === null ? currentProfile(owner) : findVersion(owner, requested), listVersions(owner),
  ])
  if (snapshot !== null && !profile) return json({ error: 'Profile version unavailable.' }, 404)
  if (!profile) return json({ profile: null, versions })
  const { revision, archived, restoredFrom, createdAt, personal, skills, experiences, projects, education, preferences } = profile
  return json({
    profile: { revision, archived, restoredFrom, createdAt, personal, skills, experiences, projects, education, preferences },
    versions,
  })
})

export const POST = route(async (request, owner) => {
  const body = await readJson(request)
  if (!body || typeof body !== 'object' || !('expectedRevision' in body) ||
      typeof body.expectedRevision !== 'number' || !Number.isSafeInteger(body.expectedRevision) ||
      body.expectedRevision < 0 || body.expectedRevision >= 2147483647 || !('kind' in body)) {
    return json({ error: 'Invalid profile revision.' }, 400)
  }
  const revision = body.expectedRevision
  let result: Awaited<ReturnType<typeof changeProfile>>
  if (body.kind === 'save' && 'profile' in body) {
    const parsed = profileSchema.safeParse(body.profile)
    if (!parsed.success) {
      const issues = [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))]
      return json({ error: 'Check these profile fields: ' + issues.join(', ') }, 400)
    }
    result = await changeProfile(owner, revision, { kind: 'save', profile: parsed.data })
  } else if (body.kind === 'archive') {
    result = await changeProfile(owner, revision, { kind: 'archive' })
  } else if (body.kind === 'restore' && 'revision' in body && typeof body.revision === 'number' &&
      Number.isSafeInteger(body.revision) && body.revision > 0 && body.revision <= revision) {
    result = await changeProfile(owner, revision, { kind: 'restore', revision: body.revision })
  } else {
    return json({ error: 'Invalid profile operation.' }, 400)
  }
  if (result.status === 200) return json({ revision: result.revision })
  const error = result.status === 409 ? 'The profile changed. Reload before saving again.' : 'Profile version unavailable.'
  return json({ error }, result.status)
}, true)
