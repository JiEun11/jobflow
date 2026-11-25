import { greenhousePayload, normalizeGreenhouse, type CollectedJob } from '@jobflow/core/greenhouse'

const maxBytes = 2 * 1024 * 1024
const maxAttempts = 3
const timeout = 10_000
const maxRetryWait = 10_000

type Failure = 'timeout' | 'network' | 'rate_limit' | 'provider_error' | 'invalid_response' | 'board_rejected'
export type BoardResult = { board: string; attempts: number } & (
  { jobs: CollectedJob[] } | { error: Failure }
)

export function approvedBoards(value: string | undefined) {
  const invalid = () => new Error('Set one to five approved Greenhouse board tokens and company names.')
  let input: unknown
  try { input = JSON.parse(value ?? '') } catch { throw invalid() }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid()
  const entries = Object.entries(input)
  if (!entries.length || entries.length > 5) throw invalid()
  return entries.map(([token, name]) => {
    if (!/^[a-z][a-z0-9_-]{0,79}$/.test(token) || typeof name !== 'string' ||
        !name.trim() || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) throw invalid()
    return { token, company: name.trim() }
  })
}

async function readPayload(response: Response) {
  if (!response.body || Number(response.headers.get('content-length')) > maxBytes) return null
  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > maxBytes) {
        void reader.cancel().catch(() => {})
        return null
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }
  try { return greenhousePayload.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
  catch { return null }
}

function retryDelay(value: string | null, attempt: number) {
  if (value === null) return 250 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250)
  const delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - Date.now()
  return Number.isFinite(delay) ? Math.max(delay, 0) : 250 * 2 ** (attempt - 1)
}

export async function fetchGreenhouseBoard(board: string, request = fetch,
  pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))): Promise<BoardResult> {
  if (!/^[a-z][a-z0-9_-]{0,79}$/.test(board)) throw new Error('Invalid board token.')
  const url = 'https://boards-api.greenhouse.io/v1/boards/' + encodeURIComponent(board) + '/jobs?content=true'
  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    const signal = AbortSignal.timeout(timeout)
    let error: Failure
    let delay: string | null = null
    try {
      const response = await request(url, { signal, redirect: 'error', headers: { Accept: 'application/json' } })
      if (response.ok) {
        const payload = await readPayload(response)
        if (!payload?.success || payload.data.meta.total !== payload.data.jobs.length ||
            new Set(payload.data.jobs.map(({ id }) => id)).size !== payload.data.jobs.length) {
          return { board, attempts, error: 'invalid_response' }
        }
        return { board, attempts, jobs: payload.data.jobs.map(normalizeGreenhouse).filter((job) => job !== null) }
      }
      void response.body?.cancel().catch(() => {})
      if (response.status !== 429 && response.status < 500) return { board, attempts, error: 'board_rejected' }
      error = response.status === 429 ? 'rate_limit' : 'provider_error'
      delay = response.headers.get('retry-after')
    } catch {
      error = signal.aborted ? 'timeout' : 'network'
    }
    const wait = retryDelay(delay, attempts)
    if (attempts === maxAttempts || wait > maxRetryWait) return { board, attempts, error }
    await pause(wait)
  }
  throw new Error('Invalid retry state.')
}
