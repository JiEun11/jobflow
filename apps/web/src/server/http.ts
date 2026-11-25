import { appOrigin, ownerId } from './auth'

const noStore = { 'Cache-Control': 'private, no-store' }
export const json = (data: unknown, status = 200) => Response.json(data, {
  status,
  // Rejections can return before consuming the body. Do not reuse that connection.
  headers: status >= 400 ? { ...noStore, Connection: 'close' } : noStore,
})

export class RequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

export function route(
  operation: (request: Request, principal: string) => Promise<Response>,
  mutation = false,
) {
  return async (request: Request) => {
    try {
      if (mutation && request.headers.get('origin') !== appOrigin()) {
        return json({ error: 'Origin is not allowed.' }, 403)
      }
      const principal = await ownerId(request.headers)
      if (!principal) return json({ error: 'Sign in to continue.' }, 401)
      return await operation(request, principal)
    } catch (error) {
      if (error instanceof RequestError) return json({ error: error.message }, error.status)
      console.error('A protected request failed.')
      return json({ error: 'Request failed. Try again.' }, 500)
    }
  }
}

export async function readBody(request: Request, maximum: number) {
  const length = request.headers.get('content-length')
  if (length && Number(length) > maximum) throw new RequestError(413, 'File or request is too large.')
  if (!request.body) throw new RequestError(400, 'A request body is required.')
  const reader = request.body.getReader()
  let total = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return Buffer.concat(chunks, total)
      total += value.byteLength
      if (total > maximum) {
        throw new RequestError(413, 'File or request is too large.')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
}

export async function readJson(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    throw new RequestError(415, 'JSON is required.')
  }
  const body = await readBody(request, 4_194_304)
  try { return JSON.parse(body.toString('utf8')) as unknown }
  catch { throw new RequestError(400, 'Invalid JSON.') }
}
