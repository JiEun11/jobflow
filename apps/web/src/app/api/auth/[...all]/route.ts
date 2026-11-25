import { appOrigin, authServer } from '../../../../server/auth'
import { json, readBody, RequestError } from '../../../../server/http'

async function authResponse(request: Request) {
  const response = await authServer().handler(request)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export function GET(request: Request) {
  if (new URL(request.url).pathname !== '/api/auth/get-session') return json({}, 404)
  return authResponse(request)
}

export async function POST(request: Request) {
  const path = new URL(request.url).pathname
  if (path !== '/api/auth/sign-in/email' && path !== '/api/auth/sign-out') return json({}, 404)
  if (request.headers.get('origin') !== appOrigin()) return json({ error: 'Origin is not allowed.' }, 403)
  if (request.headers.get('content-type') !== 'application/json') return json({ error: 'JSON is required.' }, 415)
  try {
    const body = await readBody(request, 4096)
    return await authResponse(new Request(request.url, {
      method: 'POST', headers: request.headers, body: new Uint8Array(body),
    }))
  } catch (error) {
    if (error instanceof RequestError) return json({ error: error.message }, error.status)
    return json({ error: 'Authentication request failed.' }, 500)
  }
}
