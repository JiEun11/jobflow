import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { copyFile, mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { chromium } from 'playwright'
import { connectDatabase } from '../packages/db/src/client.ts'
import { collect } from '../packages/db/src/collector.ts'

const web = resolve('apps/web')
const db = resolve('packages/db')
const webRequire = createRequire(join(web, 'package.json'))
const { PDFDocument } = webRequire('pdf-lib')
const dbRequire = createRequire(join(db, 'package.json'))
const { migrate: applyMigrations } = dbRequire('drizzle-orm/node-postgres/migrator')
const pgBin = process.env.JOBFLOW_TEST_PG_BIN ?? ''
const email = 'synthetic@example.test'
const password = 'synthetic-' + randomBytes(24).toString('hex')

function postgres(command, args) {
  return execFileSync(pgBin ? join(pgBin, command) : command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

async function availablePort() {
  const socket = createServer()
  socket.listen(0, '127.0.0.1')
  await once(socket, 'listening')
  const { port } = socket.address()
  await new Promise((done) => socket.close(done))
  return port
}

async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  const closed = once(child, 'exit')
  child.kill('SIGTERM')
  await closed
}

test('Jobflow against a fresh local PostgreSQL and the production server', { timeout: 90_000 }, async (t) => {
  const temp = await mkdtemp(join(process.platform === 'darwin' ? '/tmp' : tmpdir(), 'jf-'))
  const data = join(temp, 'postgres')
  const socket = join(temp, 'socket')
  const uploads = join(temp, 'uploads')
  const port = await availablePort()
  const origin = 'http://127.0.0.1:' + port
  const env = {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: '1',
    DATABASE_URL: 'postgresql://jobflow_test@localhost/postgres?host=' + encodeURIComponent(socket),
    BETTER_AUTH_SECRET: randomBytes(48).toString('hex'),
    JOBFLOW_APP_URL: origin,
    JOBFLOW_DATA_DIR: uploads,
  }
  let app
  let pgStarted = false
  let serverLog = ''
  let cookie
  let resume
  let bytes

  async function startApp(overrides = {}) {
    app = spawn(process.execPath, [webRequire.resolve('next/dist/bin/next'), 'start',
      '--hostname', '127.0.0.1', '--port', String(port)], { cwd: web, env: { ...env, ...overrides } })
    app.stdout.on('data', (chunk) => { serverLog += chunk })
    app.stderr.on('data', (chunk) => { serverLog += chunk })
    for (let attempt = 0; attempt < 60; attempt++) {
      if (app.exitCode !== null) throw new Error('Next.js exited during startup: ' + serverLog)
      try { await request('/login'); return } catch { await delay(100) }
    }
    throw new Error('Local web server did not start.')
  }

  function request(path, options = {}) {
    const { session, json, headers, ...rest } = options
    return fetch(origin + path, {
      redirect: 'manual',
      ...rest,
      headers: {
        ...(rest.method ? { Origin: origin } : {}),
        ...(session ? { Cookie: session } : {}),
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    }).catch((cause) => { throw new Error('HTTP request failed: ' + (rest.method ?? 'GET') + ' ' + path, { cause }) })
  }

  function sql(text, role = 'jobflow_test') {
    return postgres('psql', ['-XAt', '-v', 'ON_ERROR_STOP=1', '-h', socket, '-U', role, '-d', 'postgres', '-c', text]).trim()
  }

  async function expectStatus(response, status) {
    if (response.status !== status) {
      const error = await response.text()
      assert.fail('Expected ' + status + ', got ' + response.status + ' (' + error.slice(0, 240) + ')')
    }
    return response
  }

  function bootstrap() {
    const child = spawn(process.execPath, ['scripts/owner-init.ts'], { cwd: web, env, stdio: ['pipe', 'ignore', 'ignore'] })
    child.stdin.end(email + '\n' + password + '\n')
    return once(child, 'exit').then(([code]) => code)
  }

  const signIn = (ownerEmail) => request('/api/auth/sign-in/email', { method: 'POST', json: { email: ownerEmail, password } })
  const change = (json) => request('/api/profile', { method: 'POST', session: cookie, json })
  const upload = (body, filename = 'synthetic.pdf', session = cookie) => request('/api/resumes', {
    method: 'POST', session, body,
    headers: { 'Content-Type': 'application/pdf', 'X-Jobflow-Filename': encodeURIComponent(filename) },
  })

  try {
    await mkdir(socket, { mode: 0o700 })
    postgres('initdb', ['-D', data, '-U', 'jobflow_test', '--auth=trust', '--no-locale', '--encoding=UTF8'])
    // Trust authentication is confined to the private test socket; TCP is disabled.
    postgres('pg_ctl', ['-D', data, '-l', join(temp, 'postgres.log'), '-o',
      "-c listen_addresses='' -c unix_socket_directories='" + socket + "'", '-w', 'start'])
    pgStarted = true
    const migrate = () => execFileSync(process.execPath, ['src/migrate.ts'], { cwd: db, env, encoding: 'utf8' })
    const baseline = join(temp, 'phase1-migrations')
    const journal = JSON.parse(await readFile(join(db, 'migrations/meta/_journal.json'), 'utf8'))
    const first = journal.entries[0]
    await mkdir(join(baseline, 'meta'), { recursive: true })
    await copyFile(join(db, 'migrations', first.tag + '.sql'), join(baseline, first.tag + '.sql'))
    await writeFile(join(baseline, 'meta/_journal.json'), JSON.stringify({ ...journal, entries: [first] }))
    const admin = connectDatabase(env.DATABASE_URL)
    try {
      await applyMigrations(admin.db, { migrationsFolder: baseline })
    } finally {
      await admin.pool.end()
    }
    sql("insert into public.auth_user (id,name,email) values ('migration-fixture','Fixture','migration@example.test')")
    migrate()
    migrate()
    assert.equal(sql("select count(*) from public.auth_user where id = 'migration-fixture'"), '1')
    sql("delete from public.auth_user where id = 'migration-fixture'")
    await startApp()

    await t.test('anonymous requests and HTTP signup are blocked on an empty database', async () => {
      for (const path of ['/', '/profile']) {
        const response = await expectStatus(await request(path), 307)
        assert.equal(response.headers.get('location'), '/login')
      }
      for (const path of ['/api/profile', '/api/resumes', '/api/resumes/' + randomUUID()]) {
        await expectStatus(await request(path), 401)
      }
      await expectStatus(await request('/api/auth/sign-up/email', { method: 'POST', json: { email, password, name: 'Synthetic' } }), 404)
      assert.equal(sql('select count(*) from auth_user'), '0')
    })

    await t.test('exactly one concurrent CLI bootstrap succeeds, and login creates an owner session', async () => {
      assert.deepEqual((await Promise.all([bootstrap(), bootstrap()])).sort(), [0, 1])
      assert.equal(sql('select count(*) from auth_user'), '1')
      assert.equal(sql('select count(*) from auth_account'), '1')
      assert.equal(sql('select count(*) from owner'), '1')
      const signedIn = await expectStatus(await signIn(email), 200)
      const tokens = signedIn.headers.getSetCookie()
      assert.ok(tokens.some((entry) => /httponly/i.test(entry)))
      cookie = tokens.map((value) => value.split(';')[0]).join('; ')
      const session = await (await expectStatus(await request('/api/auth/get-session', { session: cookie }), 200)).json()
      assert.equal(session.user.email, email)
    })

    await t.test('a different user, spoofed owner ID, and foreign-origin mutation cannot access owner data', async () => {
      sql("insert into auth_user (id, name, email) values ('other-test-id', 'Other', 'other@example.test')")
      sql("insert into auth_account (id, account_id, provider_id, user_id, password) select 'other-account', 'other-test-id', 'credential', 'other-test-id', password from auth_account limit 1")
      assert.ok((await signIn('other@example.test')).status >= 400)
      assert.equal(sql("select count(*) from auth_session where user_id = 'other-test-id'"), '0')
      sql("delete from auth_user where id = 'other-test-id'")
      await expectStatus(await request('/api/profile?ownerId=other-test-id', { headers: { 'X-Owner-Id': 'owner' } }), 401)
      await expectStatus(await request('/api/profile', {
        method: 'POST', session: cookie, json: { kind: 'archive' }, headers: { Origin: 'https://foreign.example.test' },
      }), 403)
    })

    await t.test('structured profile CRUD, concurrent edit protection, immutable versions and restore', async () => {
      const skill = { id: randomUUID(), name: 'React', category: 'Frontend' }
      const evidence = { outcome: 'Reduced synthetic processing time by 30%', source: 'Synthetic benchmark' }
      const profile = {
        personal: { name: 'Synthetic Candidate', email: '', phone: '', location: '', summary: '' },
        skills: [skill],
        experiences: [{ id: randomUUID(), company: 'Synthetic Studio', title: 'Developer', period: '2023–2025',
          description: 'Built a test project', skillIds: [skill.id], evidence: [evidence] }],
        projects: [{ id: randomUUID(), name: 'Synthetic Project', description: '', skillIds: [skill.id], evidence: [evidence] }],
        education: [{ id: randomUUID(), institution: 'Synthetic University', qualification: 'BSc', period: '' }],
        preferences: { country: 'Canada', priorityLocation: 'Vancouver, British Columbia',
          roles: ['Full Stack Developer', 'Frontend / React Developer'], collectionTime: '09:00', timezone: 'Asia/Seoul' },
      }
      await expectStatus(await change({ kind: 'save', expectedRevision: 0,
        profile: { ...profile, skills: [] } }), 400)
      await expectStatus(await change({ kind: 'save', expectedRevision: 0, profile }), 200)
      const updated = { ...profile, personal: { ...profile.personal, name: 'Updated Synthetic Candidate' } }
      const competing = await Promise.all([change({ kind: 'save', expectedRevision: 1, profile: updated }),
        change({ kind: 'save', expectedRevision: 1, profile: updated })])
      assert.deepEqual(competing.map((response) => response.status).sort(), [200, 409])
      const first = await (await request('/api/profile?version=1', { session: cookie })).json()
      assert.deepEqual(first.profile.experiences, profile.experiences)
      assert.equal(first.profile.personal.name, profile.personal.name)
      assert.throws(() => sql("update profile_version set archived = true where revision = 1"), /append-only/)
      assert.throws(() => sql('delete from profile_version where revision = 1'), /append-only/)
      await expectStatus(await change({ kind: 'archive', expectedRevision: 2 }), 200)
      assert.equal((await (await request('/api/profile', { session: cookie })).json()).profile.archived, true)
      await expectStatus(await change({ kind: 'restore', expectedRevision: 3, revision: 1 }), 200)
      const restored = await (await request('/api/profile', { session: cookie })).json()
      assert.equal(restored.profile.restoredFrom, 1)
      assert.equal(restored.profile.personal.name, profile.personal.name)
      assert.deepEqual(restored.versions.map(({ revision }) => revision), [4, 3, 2, 1])
      assert.match(await (await request('/profile?version=1', { session: cookie })).text(), /Viewing version/)
    })

    await t.test('valid PDF is private; fake PDFs, oversized requests and unauthorized access fail', async () => {
      const pdf = await PDFDocument.create()
      pdf.addPage().drawText('Synthetic PDF only')
      bytes = await pdf.save()
      await expectStatus(await upload(Buffer.from('fake')), 415)
      await expectStatus(await upload(Buffer.from('%PDF-1.7\nnot actual objects\n%%EOF')), 415)
      await expectStatus(await upload(Buffer.alloc(5 * 1024 * 1024 + 1)), 413)
      const chunked = async function* () {
        for (let i = 0; i < 6; i++) yield Buffer.alloc(1024 * 1024)
      }
      await expectStatus(await request('/api/resumes', { method: 'POST', session: cookie, duplex: 'half',
        body: chunked(), headers: { 'Content-Type': 'application/pdf' } }), 413)
      await expectStatus(await upload(bytes, 'synthetic.pdf', ''), 401)
      resume = await (await expectStatus(await upload(bytes, '../경력.pdf'), 201)).json()
      assert.equal(resume.filename, '경력.pdf')
      assert.deepEqual(await readdir(uploads), [resume.id + '.pdf'])
      assert.deepEqual(new Uint8Array(await readFile(join(uploads, resume.id + '.pdf'))), bytes)
      const path = '/api/resumes/' + resume.id
      await expectStatus(await request(path), 401)
      await expectStatus(await request('/api/resumes/' + randomUUID(), { session: cookie }), 404)
      const downloaded = await expectStatus(await request(path, { session: cookie }), 200)
      assert.match(downloaded.headers.get('content-disposition'), /^attachment; filename=resume.pdf; filename\*=UTF-8''%/)
      assert.equal(downloaded.headers.get('cache-control'), 'private, no-store')
      assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), bytes)
      const html = await (await request('/', { session: cookie })).text()
      for (const content of ['Master Career Profile', 'Synthetic Studio', 'React', 'Vancouver', '경력.pdf', 'Last modified']) {
        assert.ok(html.includes(content), content)
      }
    })

    await t.test('a persisted non-owner session cannot list, download, or delete an existing resume', async () => {
      const path = '/api/resumes/' + resume.id
      const headers = { 'X-Owner-Id': sql('select user_id from owner') }
      sql("insert into auth_user (id, name, email) values ('resume-non-owner', 'Other', 'other@example.test')")
      try {
        // Retain the signed cookie but associate it with a non-owner in the disposable DB.
        assert.equal(sql("with reassigned as (update auth_session set user_id = 'resume-non-owner' where user_id = (select user_id from owner) returning 1) select count(*) from reassigned"), '1')
        await expectStatus(await request('/api/resumes', { session: cookie, headers }), 401)
        await expectStatus(await request(path, { session: cookie, headers }), 401)
        await expectStatus(await request(path, { method: 'DELETE', session: cookie, headers }), 401)
      } finally {
        sql("update auth_session set user_id = (select user_id from owner) where user_id = 'resume-non-owner'")
        sql("delete from auth_user where id = 'resume-non-owner'")
      }
      await expectStatus(await request(path, { session: cookie }), 200)
    })

    await t.test('profile, file, and session survive app and PostgreSQL restarts; deletion retries safely', async () => {
      await stop(app)
      postgres('pg_ctl', ['-D', data, '-l', join(temp, 'postgres.log'), '-m', 'fast', '-w', 'restart'])
      await startApp()
      const profile = await (await expectStatus(await request('/api/profile', { session: cookie }), 200)).json()
      assert.equal(profile.profile.revision, 4)
      const path = '/api/resumes/' + resume.id
      const response = await expectStatus(await request(path, { session: cookie }), 200)
      assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes)
      await rename(uploads, uploads + '-moved')
      // Point the original location at an unsuitable existing entry so deletion fails after the DB marker.
      await mkdir(uploads, { mode: 0o755 })
      await expectStatus(await request(path, { method: 'DELETE', session: cookie }), 500)
      await expectStatus(await request(path, { session: cookie }), 404)
      assert.equal((await (await request('/api/resumes', { session: cookie })).json())[0].deleting, true)
      await rm(uploads, { recursive: true })
      await rename(uploads + '-moved', uploads)
      await expectStatus(await request(path, { method: 'DELETE', session: cookie }), 200)
      assert.deepEqual(await readdir(uploads), [])
      assert.deepEqual(await (await request('/api/resumes', { session: cookie })).json(), [])
    })

    await t.test('logout revokes the session and cannot reopen registration', async () => {
      await expectStatus(await request('/api/auth/sign-out', { method: 'POST', session: cookie, json: {} }), 200)
      await expectStatus(await request('/api/profile', { session: cookie }), 401)
      await expectStatus(await request('/api/auth/sign-up/email', { method: 'POST', json: { email, password, name: 'Synthetic' } }), 404)
      assert.ok(!serverLog.includes(password) && !serverLog.includes(email) && !serverLog.includes('경력.pdf'))
    })
    await t.test('desktop and mobile complete the real browser workflow', async () => {
      sql('delete from public.auth_rate_limit')
      const browser = await chromium.launch()
      try {
        for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
          const page = await browser.newPage({ viewport, isMobile: viewport.width === 390, hasTouch: viewport.width === 390 })
          try {
            await page.goto(origin)
            await page.getByLabel('Email', { exact: true }).fill(email)
            await page.getByLabel('Password', { exact: true }).fill(password)
            await page.getByRole('button', { name: 'Sign in', exact: true }).click()
            await page.getByRole('heading', { name: 'Today', exact: true }).waitFor()
            await page.getByRole('link', { name: 'Edit profile' }).click()
            await page.getByRole('heading', { name: 'Master Career Profile' }).waitFor()
            const name = 'Browser Candidate ' + viewport.width
            await page.getByLabel('Full name').fill(name)
            await page.getByRole('button', { name: 'Save profile' }).click()
            await page.getByText('Current version ' + (viewport.width === 1440 ? 5 : 6)).waitFor()
            await page.getByRole('link', { name: 'Today', exact: true }).click()
            await page.getByRole('heading', { name: 'Today', exact: true }).waitFor()
            const filename = 'browser-' + viewport.width + '.pdf'
            await page.getByLabel('PDF file').setInputFiles({
              name: filename, mimeType: 'application/pdf', buffer: Buffer.from(bytes),
            })
            await page.getByRole('button', { name: 'Upload PDF' }).click()
            const row = page.getByRole('listitem').filter({ hasText: filename })
            await row.waitFor()
            const [download] = await Promise.all([page.waitForEvent('download'), row.getByRole('link', { name: 'Download' }).click()])
            assert.equal(download.suggestedFilename(), filename)
            assert.deepEqual(new Uint8Array(await readFile(await download.path())), bytes)
            await page.reload()
            await row.waitFor()
            assert.equal(await page.evaluate(() =>
              document.documentElement.scrollWidth <= document.documentElement.clientWidth), true)
            await page.getByRole('button', { name: 'Sign out' }).click()
            await page.getByRole('heading', { name: 'Sign in' }).waitFor()
          } finally {
            await page.close()
          }
        }
      } finally {
        await browser.close()
      }
    })
    await t.test('collector logs partial failures, retries safely, and fences concurrent deliveries', async () => {
      sql('create role jobflow_collector login; create role jobflow_web login;')
      postgres('psql', ['-Xq', '-v', 'ON_ERROR_STOP=1', '-h', socket, '-U', 'jobflow_test', '-d', 'postgres',
        '-f', resolve('ops/neon/grants.sql')])
      assert.throws(() => sql('select email from public.auth_user', 'jobflow_collector'), /permission denied/)
      assert.throws(() => sql('select filename from public.resume', 'jobflow_collector'), /permission denied/)
      assert.throws(() => sql('update jobflow_collection.run set attempt = 123', 'jobflow_web'), /permission denied/)

      const connection = connectDatabase(env.DATABASE_URL.replace('jobflow_test@', 'jobflow_collector@'), 1)
      const boardConfig = '{"fixture":"Fixture Studio","other":"Other Studio"}'
      const newRevision = (description) => Response.json({
        jobs: [{
          id: 1, title: 'Full Stack Engineer', location: { name: 'Vancouver, BC' },
          absolute_url: 'https://example.test/fixture/1', content: '<p>' + description + '</p>',
        }], meta: { total: 1 },
      })
      try {
        const part = await collect(connection.db, { boards: boardConfig, trigger: 'manual', day: '2020-01-01',
          request: async (url) => url.includes('/other/') ? new Response(null, { status: 404 }) : newRevision('First JD'),
        })
        assert.equal(part, 'partial')
        assert.equal(sql("select status from jobflow_collection.attempt where day = '2020-01-01'"), 'partial')
        assert.equal(sql("select error from jobflow_collection.board_result where board = 'other'"), 'board_rejected')
        assert.equal(sql('select count(*) from jobflow_collection.job'), '1')
        const replay = await collect(connection.db, { boards: boardConfig, trigger: 'manual', day: '2020-01-01',
          request: async (url) => newRevision(url.includes('/other/') ? 'Other JD' : 'Changed JD'),
        })
        assert.equal(replay, 'success')
        assert.equal(sql("select string_agg(status::text, ',' order by attempt) from jobflow_collection.attempt where day = '2020-01-01'"),
          'partial,success')
        assert.equal(sql('select count(*) from jobflow_collection.job'), '2')
        assert.equal(sql('select count(*) from jobflow_collection.job_snapshot'), '3')
        assert.equal(await collect(connection.db, { boards: boardConfig, trigger: 'manual', day: '2020-01-01',
          request: async () => { assert.fail('successful occurrence must not fetch again') } }), 'already_collected')

        const entered = Promise.withResolvers()
        const release = Promise.withResolvers()
        const scheduled = { boards: '{"fixture":"Fixture Studio"}', trigger: 'schedule' }
        const active = collect(connection.db, { ...scheduled,
          request: async () => { entered.resolve(); await release.promise; return newRevision('First JD') },
        })
        try {
          await Promise.race([entered.promise, active.then(() => assert.fail('expected scheduled request'))])
          assert.equal(await collect(connection.db, { ...scheduled,
            request: async () => { assert.fail('concurrent occurrence must not fetch') } }), 'busy')
        } finally {
          release.resolve()
          assert.equal(await active, 'success')
        }
        assert.equal(await collect(connection.db, { ...scheduled,
          request: async () => { assert.fail('duplicate schedule delivery must not fetch') } }), 'already_collected')
        assert.equal(sql("select string_agg(jd, ',' order by s.revision) from jobflow_collection.job_snapshot s join jobflow_collection.job j on j.id = s.job_id where j.board = 'fixture'"),
          'First JD,Changed JD,First JD')
        assert.throws(() => sql("update jobflow_collection.job_snapshot set jd = 'altered'"), /append-only/)
        assert.throws(() => sql("update jobflow_collection.job_snapshot set jd = 'altered'", 'jobflow_collector'), /permission denied/)

        assert.equal(await collect(connection.db, { ...scheduled, trigger: 'manual', day: '2020-01-02',
          request: async () => newRevision('First JD') }), 'success')
        assert.equal(sql('select count(*) from jobflow_collection.job_snapshot'), '4')
        sql("insert into jobflow_collection.run values ('2020-01-03', 1, 'running', now(), null, now() - interval '1 hour')")
        sql("insert into jobflow_collection.attempt (day, attempt, trigger, status, started_at) values ('2020-01-03', 1, 'schedule', 'running', now())")
        assert.equal(await collect(connection.db, { ...scheduled, trigger: 'manual', day: '2020-01-03',
          request: async () => newRevision('First JD') }), 'success')
        assert.equal(sql("select error from jobflow_collection.attempt where day = '2020-01-03' and attempt = 1"), 'lease_expired')
      } finally {
        await connection.pool.end()
      }
    })

    await t.test('restricted web role serves protected collected jobs and keeps PDF unavailable', async () => {
      await stop(app)
      await startApp({ DATABASE_URL: env.DATABASE_URL.replace('jobflow_test@', 'jobflow_web@'), JOBFLOW_DISABLE_PDF: '1' })
      const id = sql("select id from jobflow_collection.job where board = 'fixture'")
      const path = '/jobs/' + id
      for (const route of ['/', path]) {
        assert.equal((await expectStatus(await request(route), 307)).headers.get('location'), '/login')
      }
      const health = await expectStatus(await request('/api/health'), 200)
      assert.deepEqual(await health.json(), { status: 'ok' })
      const login = await expectStatus(await signIn(email), 200)
      const session = login.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ')
      assert.match(await (await expectStatus(await request('/', { session }), 200)).text(), /Fixture Studio/)
      assert.match(await (await expectStatus(await request(path, { session }), 200)).text(), /First JD/)
      assert.match(await (await expectStatus(await request('/', { session }), 200)).text(), /PDF storage is unavailable/)
      await expectStatus(await request('/api/resumes', { session }), 404)
      await expectStatus(await upload(bytes, 'disabled.pdf', session), 404)
      await expectStatus(await request('/api/resumes/' + randomUUID(), { session }), 404)
      await expectStatus(await request('/api/auth/sign-out', { method: 'POST', session, json: {} }), 200)
    })

    await t.test('database authentication throttle persists across application restarts', async () => {
      sql('delete from public.auth_rate_limit')
      for (let attempt = 0; attempt < 3; attempt++) {
        await expectStatus(await signIn('unknown@example.test'), 401)
      }
      await stop(app)
      await startApp({ DATABASE_URL: env.DATABASE_URL.replace('jobflow_test@', 'jobflow_web@'), JOBFLOW_DISABLE_PDF: '1' })
      await expectStatus(await signIn('unknown@example.test'), 429)
    })

    await t.test('Preview fails closed even when configured with a working database URL', async () => {
      await stop(app)
      const before = sql('select count(*) from public.auth_session')
      await startApp({ VERCEL: '1', VERCEL_ENV: 'preview' })
      await expectStatus(await request('/api/health'), 503)
      await expectStatus(await signIn(email), 503)
      assert.equal((await expectStatus(await request('/'), 307)).headers.get('location'), '/login')
      assert.match(await (await request('/login')).text(), /Sign-in is disabled/)
      assert.equal(sql('select count(*) from public.auth_session'), before)
    })
  } finally {
    await stop(app)
    if (pgStarted) postgres('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop'])
    await rm(temp, { recursive: true, force: true })
  }
})
