import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import { hashPassword } from 'better-auth/crypto'
import { sql } from 'drizzle-orm'
import { connectDatabase } from '@jobflow/db/client'
import { account, owner, user } from '@jobflow/db/schema'
import { isNeonUrl, neonConnectionString } from '@jobflow/db/neon'

let hide = false
const output = new Writable({
  write(chunk, _encoding, done) {
    if (!hide) process.stderr.write(chunk)
    done()
  },
})
const terminal = Boolean(process.stdin.isTTY && process.stderr.isTTY)
const cloud = process.argv.includes('--cloud')
if (!cloud && isNeonUrl(process.env.DATABASE_URL)) throw new Error('Use the approved cloud owner setup command.')
if (cloud && !terminal) throw new Error('Cloud owner setup requires an interactive terminal.')
const input = createInterface({ input: process.stdin, output, terminal })
const lines = input[Symbol.asyncIterator]()

async function read(label: string, secret = false) {
  if (terminal) process.stderr.write(label)
  hide = secret
  const line = await lines.next()
  hide = false
  if (terminal && secret) process.stderr.write('\n')
  if (line.done) throw new Error('Incomplete credentials.')
  return line.value
}

let connection: ReturnType<typeof connectDatabase> | undefined
try {
  const email = (await read('Owner email: ')).trim().toLowerCase()
  const password = await read('Owner password: ', true)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      password.length < 14 || password.length > 128) {
    throw new Error('Enter a valid email and a password of 14–128 characters.')
  }
  const hashedPassword = await hashPassword(password)
  connection = cloud
    ? connectDatabase(neonConnectionString(process.env.JOBFLOW_ADMIN_DATABASE_URL, 'direct'), 1)
    : connectDatabase()
  const created = await connection.db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(368092585027)`)
    const [existing] = await tx.select({ slot: owner.slot }).from(owner).limit(1)
    if (existing) return false
    const id = randomUUID()
    await tx.insert(user).values({ id, name: 'Owner', email })
    await tx.insert(account).values({
      id: randomUUID(), userId: id, accountId: id, providerId: 'credential', password: hashedPassword,
    })
    await tx.insert(owner).values({ userId: id })
    return true
  })
  console.log(created ? 'Owner initialized.' : 'Owner already exists.')
  if (!created) process.exitCode = 1
} catch {
  console.error('Owner initialization failed. Check the database, email and password requirements.')
  process.exitCode = 1
} finally {
  input.close()
  await connection?.pool.end()
}
