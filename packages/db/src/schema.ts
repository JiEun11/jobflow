import { sql } from 'drizzle-orm'
import { bigint, boolean, check, date, foreignKey, integer, jsonb, pgSchema, pgTable, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import type { Profile } from '@jobflow/core/profile'

const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 })

export const user = pgTable('auth_user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text(),
  createdAt: instant('created_at').defaultNow().notNull(),
  updatedAt: instant('updated_at').defaultNow().notNull(),
})

export const session = pgTable('auth_session', {
  id: text().primaryKey(),
  token: text().notNull().unique(),
  expiresAt: instant('expires_at').notNull(),
  createdAt: instant('created_at').defaultNow().notNull(),
  updatedAt: instant('updated_at').defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('auth_account', {
  id: text().primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: instant('access_token_expires_at'),
  refreshTokenExpiresAt: instant('refresh_token_expires_at'),
  scope: text(),
  password: text(),
  createdAt: instant('created_at').defaultNow().notNull(),
  updatedAt: instant('updated_at').defaultNow().notNull(),
})

export const verification = pgTable('auth_verification', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: instant('expires_at').notNull(),
  createdAt: instant('created_at').defaultNow().notNull(),
  updatedAt: instant('updated_at').defaultNow().notNull(),
})

export const rateLimit = pgTable('auth_rate_limit', {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
})

export const owner = pgTable('owner', {
  slot: integer().primaryKey().default(1),
  userId: text('user_id').notNull().unique().references(() => user.id),
}, (table) => [check('owner_singleton', sql`${table.slot} = 1`)])

export const profileVersion = pgTable('profile_version', {
  ownerId: text('owner_id').notNull().references(() => owner.userId),
  revision: integer().notNull(),
  createdAt: instant('created_at').defaultNow().notNull(),
  archived: boolean().default(false).notNull(),
  restoredFrom: integer('restored_from'),
  personal: jsonb().$type<Profile['personal']>().notNull(),
  experiences: jsonb().$type<Profile['experiences']>().notNull(),
  skills: jsonb().$type<Profile['skills']>().notNull(),
  projects: jsonb().$type<Profile['projects']>().notNull(),
  education: jsonb().$type<Profile['education']>().notNull(),
  preferences: jsonb().$type<Profile['preferences']>().notNull(),
}, (table) => [
  primaryKey({ columns: [table.ownerId, table.revision] }),
  check('profile_positive_revision', sql`${table.revision} > 0`),
  check('profile_prior_restore', sql`${table.restoredFrom} > 0 AND ${table.restoredFrom} < ${table.revision}`),
])

export const resume = pgTable('resume', {
  id: uuid().primaryKey(),
  ownerId: text('owner_id').notNull().references(() => owner.userId),
  filename: text().notNull(),
  byteSize: integer('byte_size').notNull(),
  digest: text().notNull(),
  createdAt: instant('created_at').defaultNow().notNull(),
  deletionRequestedAt: instant('deletion_requested_at'),
}, (table) => [check('resume_size', sql`${table.byteSize} > 0 AND ${table.byteSize} <= 5242880`)])

export const collection = pgSchema('jobflow_collection')
export const collectionStatus = collection.enum('status', ['running', 'success', 'partial', 'failed'])

export const collectionRun = collection.table('run', {
  day: date().primaryKey(),
  attempt: integer().notNull(),
  status: collectionStatus().notNull(),
  startedAt: instant('started_at').notNull(),
  finishedAt: instant('finished_at'),
  leaseUntil: instant('lease_until').notNull(),
})

export const collectionAttempt = collection.table('attempt', {
  day: date().notNull().references(() => collectionRun.day),
  attempt: integer().notNull(),
  trigger: text().notNull(),
  status: collectionStatus().notNull(),
  startedAt: instant('started_at').notNull(),
  finishedAt: instant('finished_at'),
  error: text(),
}, (table) => [
  primaryKey({ columns: [table.day, table.attempt] }),
  check('collection_trigger', sql`${table.trigger} in ('schedule', 'manual')`),
])

export const collectionBoard = collection.table('board_result', {
  day: date().notNull(),
  attempt: integer().notNull(),
  board: text().notNull(),
  status: collectionStatus().notNull(),
  added: integer().notNull().default(0),
  revised: integer().notNull().default(0),
  matched: integer().notNull().default(0),
  httpAttempts: integer('http_attempts').notNull(),
  error: text(),
}, (table) => [
  primaryKey({ columns: [table.day, table.attempt, table.board] }),
  foreignKey({ columns: [table.day, table.attempt], foreignColumns: [collectionAttempt.day, collectionAttempt.attempt] }),
])

export const job = collection.table('job', {
  id: uuid().primaryKey().defaultRandom(),
  provider: text().notNull(),
  board: text().notNull(),
  externalId: text('external_id').notNull(),
  revision: integer().notNull(),
  firstSeenAt: instant('first_seen_at').notNull(),
  lastSeenAt: instant('last_seen_at').notNull(),
}, (table) => [unique().on(table.provider, table.board, table.externalId)])

export const jobSnapshot = collection.table('job_snapshot', {
  jobId: uuid('job_id').notNull().references(() => job.id),
  revision: integer().notNull(),
  digest: text().notNull(),
  title: text().notNull(),
  company: text().notNull(),
  location: text().notNull(),
  url: text().notNull(),
  jd: text().notNull(),
  priority: integer().notNull(),
  capturedAt: instant('captured_at').notNull(),
}, (table) => [primaryKey({ columns: [table.jobId, table.revision] })])
