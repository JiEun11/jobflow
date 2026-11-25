import { spawn } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { mkdir, open, realpath, stat, unlink } from 'node:fs/promises'
import { isAbsolute, resolve, sep } from 'node:path'
import { storeResume } from '@jobflow/db/resumes'
import { RequestError, readBody } from './http'

export const maxPdfBytes = 5 * 1024 * 1024
export const isResumeId = (id: string) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)

async function storagePath(id: string) {
  if (!isResumeId(id)) throw new RequestError(404, 'Resume unavailable.')
  const configured = process.env.JOBFLOW_DATA_DIR
  if (!configured || !isAbsolute(configured)) throw new Error('A private absolute data path is required.')
  const workspace = await realpath(resolve(process.cwd(), '../..'))
  const intended = resolve(configured)
  const insideCheckout = (path: string) => path === workspace || path.startsWith(workspace + sep)
  if (insideCheckout(intended)) throw new Error('Private data must be outside the checkout.')

  // Resolve the existing parent before creating anything, including through a symlink.
  const parent = await realpath(resolve(intended, '..'))
  const directory = resolve(parent, intended.split(sep).at(-1) ?? '')
  if (insideCheckout(directory)) throw new Error('Private data must be outside the checkout.')
  await mkdir(directory, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'EEXIST') throw error
  })
  const actual = await realpath(directory)
  const details = await stat(actual)
  if (actual !== directory || insideCheckout(actual) || !details.isDirectory() ||
      (details.mode & 0o077) || details.uid !== process.getuid?.()) {
    throw new Error('Use a private directory owned by the app user (0700).')
  }
  return resolve(actual, id + '.pdf')
}

function safeName(encoded: string | null) {
  let name: string
  try { name = decodeURIComponent(encoded ?? '') }
  catch { throw new RequestError(400, 'Invalid filename.') }
  name = name.split(/[\\/]/).at(-1)?.replace(/[\p{Cc}\p{Cf}]/gu, '').trim() ?? ''
  const base = Array.from(name.replace(/\.pdf$/i, '').replace(/^\.+/, '')).slice(0, 120).join('')
  return (base || 'resume') + '.pdf'
}

export function attachmentName(name: string) {
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (char) =>
    '%' + char.codePointAt(0)!.toString(16).toUpperCase())
  return "attachment; filename=resume.pdf; filename*=UTF-8''" + encoded
}

const validatePdfScript = `
  import { PDFDocument } from 'pdf-lib'
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const pdf = await PDFDocument.load(Buffer.concat(chunks), {
    throwOnInvalidObject: true, capNumbers: true, updateMetadata: false,
  })
  if (pdf.getPageCount() < 1) process.exitCode = 1
`
let activeValidations = 0

async function validatePdf(data: Buffer) {
  if (!/^%PDF-(?:1\.[0-7]|2\.0)(?:\r|\n)/.test(data.subarray(0, 12).toString('latin1')) ||
      !/%%EOF[\t\f\r\n ]*$/.test(data.subarray(-1024).toString('latin1'))) {
    throw new RequestError(415, 'A valid PDF is required.')
  }
  if (activeValidations >= 2) throw new RequestError(429, 'Uploads are busy. Try again.')
  activeValidations++
  try {
    const valid = await new Promise<boolean>((done) => {
      const child = spawn(process.execPath, [
        '--max-old-space-size=96', '--disable-warning=ExperimentalWarning',
        '--input-type=module', '-e', validatePdfScript,
      ], { env: { NODE_ENV: 'production' }, stdio: ['pipe', 'ignore', 'ignore'], timeout: 3500, killSignal: 'SIGKILL' })
      child.once('error', () => done(false))
      child.once('close', (code) => done(code === 0))
      child.stdin.on('error', () => {})
      child.stdin.end(data)
    })
    if (!valid) throw new RequestError(415, 'The PDF is damaged, encrypted, or too complex.')
  } finally {
    activeValidations--
  }
}

export async function uploadResume(request: Request, ownerId: string) {
  if (request.headers.get('content-type') !== 'application/pdf') {
    throw new RequestError(415, 'Only PDF uploads are supported.')
  }
  const filename = safeName(request.headers.get('x-jobflow-filename'))
  const data = await readBody(request, maxPdfBytes)
  await validatePdf(data)
  const id = randomUUID()
  const location = await storagePath(id)
  const digest = createHash('sha256').update(data).digest('hex')
  await storeResume({ id, ownerId, filename, byteSize: data.byteLength, digest }, async () => {
    const file = await open(location, 'wx', 0o600)
    try {
      await file.writeFile(data)
      await file.sync()
    } catch (error) {
      await unlink(location).catch(() => {})
      throw error
    } finally {
      await file.close()
    }
  })
  return { id, filename, byteSize: data.byteLength }
}

export async function loadResume(id: string, expectedSize: number, digest: string) {
  try {
    const file = await open(await storagePath(id), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    try {
      const details = await file.stat()
      if (!details.isFile() || details.size !== expectedSize || expectedSize > maxPdfBytes) return null
      const data = Buffer.alloc(expectedSize)
      const { bytesRead } = await file.read(data, 0, expectedSize, 0)
      if (bytesRead !== expectedSize) return null
      return createHash('sha256').update(data).digest('hex') === digest ? data : null
    } finally {
      await file.close()
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function removeResume(id: string) {
  await unlink(await storagePath(id)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error
  })
}
