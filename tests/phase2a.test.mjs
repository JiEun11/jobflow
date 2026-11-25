import assert from 'node:assert/strict'
import { test } from 'node:test'
import { webEnvironment, pdfEnabled } from '../apps/web/src/server/environment.ts'
import { neonConnectionString } from '../packages/db/src/neon.ts'
import { approvedBoards, fetchGreenhouseBoard } from '../packages/db/src/greenhouse.ts'
import { collectionDay, seoulDay } from '../packages/db/src/collector.ts'
import { matchPosting } from '../packages/core/src/greenhouse.ts'

const pooled = 'postgresql://jobflow_web:example@ep-fixture-pooler.us-east-2.aws.neon.tech/jobflow?sslmode=verify-full'

test('cloud configuration rejects insecure credentials, bad origins, and Preview', () => {
  const good = { VERCEL: '1', VERCEL_ENV: 'production', JOBFLOW_APP_URL: 'https://jobflow.example.test',
    BETTER_AUTH_SECRET: 'synthetic-build-secret-1234567890-abc', DATABASE_URL: pooled }
  assert.equal(webEnvironment(good).origin, 'https://jobflow.example.test')
  assert.equal(pdfEnabled(good), false)
  assert.equal(pdfEnabled({ JOBFLOW_DISABLE_PDF: '1' }), false)
  assert.equal(pdfEnabled({}), true)
  for (const wrong of [
    { JOBFLOW_APP_URL: 'http://jobflow.example.test' },
    { JOBFLOW_APP_URL: 'https://127.0.0.1' },
    { JOBFLOW_APP_URL: 'https://jobflow.example.test/path' },
    { DATABASE_URL: pooled.replace('-pooler', '') },
    { DATABASE_URL: pooled.replace('sslmode=verify-full', 'sslmode=require') },
    { DATABASE_URL: pooled + '&host=evil.example.test' },
    { DATABASE_URL: pooled.replace('jobflow_web', 'jobflow_collector') },
    { BETTER_AUTH_SECRET: 'a'.repeat(48) },
    { VERCEL_ENV: 'preview' },
    { VERCEL: undefined, VERCEL_ENV: undefined, JOBFLOW_APP_URL: 'http://127.0.0.1:3000' },
  ]) assert.throws(() => webEnvironment({ ...good, ...wrong }))
  assert.doesNotThrow(() => neonConnectionString(pooled.replace('-pooler', ''), 'direct'))
  assert.throws(() => neonConnectionString(pooled, 'direct'))
})

test('Seoul occurrence and manual replay dates are deterministic', () => {
  const now = new Date('2026-11-25T15:00:00Z')
  assert.equal(seoulDay(now), '2026-11-26')
  assert.equal(collectionDay(undefined, 'schedule', now), '2026-11-25')
  assert.equal(collectionDay(undefined, 'manual', now), '2026-11-26')
  assert.equal(collectionDay('2026-11-25', 'manual', now), '2026-11-25')
  assert.throws(() => collectionDay('2026-11-25', 'schedule', now))
  assert.throws(() => collectionDay('2026-11-27', 'manual', now))
  assert.throws(() => collectionDay('2026-02-30', 'manual', now))
})

test('Canada and target role evidence produce stable Vancouver priorities', () => {
  assert.equal(matchPosting('Full-Stack Engineer', 'Vancouver, BC', ''), 0)
  assert.equal(matchPosting('Front End Engineer', 'Metro Vancouver, BC', 'React required'), 1)
  assert.equal(matchPosting('Frontend Developer', 'Toronto, ON', 'React.js required'), 2)
  assert.equal(matchPosting('Full Stack', 'Remote', 'Must reside in Canada.'), 2)
  assert.equal(matchPosting('Full Stack', 'Vancouver, WA', ''), null)
  assert.equal(matchPosting('Full Stack', 'Remote', 'Canada is one of our markets.'), null)
  assert.equal(matchPosting('Backend Developer', 'Vancouver, BC', 'React required'), null)
  assert.equal(matchPosting('Frontend Developer', 'Vancouver, BC', 'Vue required'), null)
})

test('Greenhouse retries bounded transient failures and sanitizes accepted fixtures', async () => {
  assert.throws(() => approvedBoards('{"some/path":"Unsafe"}'))
  assert.deepEqual(approvedBoards('{"fixture":"Fixture Company"}'), [{ token: 'fixture', company: 'Fixture Company' }])
  const wait = []
  let calls = 0
  const payload = { jobs: [{ id: 1, title: 'Frontend Engineer', absolute_url: 'https://example.test/job/1',
    content: '&lt;p&gt;React &amp;amp; TypeScript&lt;/p&gt;&lt;script&gt;discard()&lt;/script&gt;',
    location: { name: 'Vancouver, BC' } }], meta: { total: 1 } }
  const result = await fetchGreenhouseBoard('fixture', async (url, init) => {
    assert.equal(url, 'https://boards-api.greenhouse.io/v1/boards/fixture/jobs?content=true')
    assert.equal(init.redirect, 'error')
    calls++
    return calls === 1 ? new Response(null, { status: 429, headers: { 'Retry-After': '1' } }) : Response.json(payload)
  }, async (ms) => { wait.push(ms) })
  assert.deepEqual(wait, [1000])
  assert.equal(result.attempts, 2)
  assert.equal(result.jobs[0].jd, 'React & TypeScript')
  assert.equal(result.jobs[0].priority, 0)

  const exhausted = await fetchGreenhouseBoard('fixture', async () =>
    new Response(null, { status: 503 }), async () => {})
  assert.deepEqual(exhausted, { board: 'fixture', attempts: 3, error: 'provider_error' })
  const delayed = await fetchGreenhouseBoard('fixture', async () =>
    new Response(null, { status: 429, headers: { 'Retry-After': '60' } }))
  assert.deepEqual(delayed, { board: 'fixture', attempts: 1, error: 'rate_limit' })
  const invalid = await fetchGreenhouseBoard('fixture', async () =>
    Response.json({ ...payload, meta: { total: 2 } }))
  assert.equal(invalid.error, 'invalid_response')
  const oversized = await fetchGreenhouseBoard('fixture', async () =>
    new Response('ignored', { headers: { 'Content-Length': '3000000' } }))
  assert.equal(oversized.error, 'invalid_response')
})
