# Backend Architecture

Status: **Proposed — awaiting approval**  
Review date: **2026-11-05**  
Scope: design only; the entry points, packages, and endpoints below do not exist yet.

## 1. Decision

Use a TypeScript modular monolith with two processes: a Next.js App Router application for the browser-facing backend and an independent Node.js worker for durable work. PostgreSQL holds application records and queue state; Drizzle owns application migrations and repositories; pg-boss provides the queue adapter.

The separation follows execution lifetime. A browser request validates, authorizes, reads, or accepts a command. Collection, model calls, rendering, and mailbox synchronization run in the worker. Both call the same application services. No separate REST backend, Redis service, or microservice deployment is required for the proposed first release.

Next.js supports the backend-for-frontend pattern, but its request handlers are not a durable worker runtime. Server Components should read through server-side services rather than make an HTTP request to the application's own API. These framework constraints inform this design; the package boundaries are Jobflow's own decisions. [Next.js backend-for-frontend guide](https://nextjs.org/docs/app/guides/backend-for-frontend)

## 2. Boundaries and imports

| Location | Responsibility | Allowed dependencies |
| --- | --- | --- |
| `apps/web` | Pages, Server Actions, Route Handlers, session resolution, composition root | Contracts, core, and server-only adapters |
| `apps/worker` | Scheduler, queue consumers, cancellation, retries, worker composition root | Core, contracts, database, integrations; never Next.js or React |
| `packages/core` | Domain policies, application use cases, ports | Framework-independent TypeScript; no provider SDK, database client, React, or Next.js imports |
| `packages/contracts` | Versioned request/response schemas, browser-safe DTOs, boundary errors | Zod and small browser-safe utilities; no persistence or credentials |
| `packages/db` | Drizzle schema, migrations, repositories, outbox, queue implementation | Core ports and database/queue libraries |
| `packages/integrations` | ATS, mailbox, model, artifact-storage, and document-rendering adapters | Core ports, boundary contracts, provider libraries |

Core use cases accept ports such as `JobRepository`, `ArtifactStore`, `TextGenerator`, `MailReader`, `Clock`, and `WorkRequests`. Web and worker composition roots supply implementations. Do not create a generic plugin registry in the first release: implement the selected provider behind a small interface and add another only when needed.

Database rows and SDK response objects remain inside adapters. Server-side presentation mappers select DTO fields explicitly; credentials, full mailbox bodies, internal notes, and unneeded career facts are not serialized into Client Component props. Modules exposing concrete adapters are server-only. The core contains no secrets, but the browser should import contracts rather than application services. [Next.js data security guidance](https://nextjs.org/docs/app/guides/data-security)

## 3. Read and command paths

Reads use an authorized query service directly from a Server Component. Query inputs are parsed before use and include an owner scope derived from a trusted session. The service returns a minimal DTO. It does not rely on a page, navigation menu, or proxy having already checked access.

Server Actions handle ordinary first-party mutations: save career facts, update preferences, add a pasted JD, shortlist a job, change an application stage, and request background work. An action performs boundary validation, resolves the principal, invokes one use case, and returns a typed result. Long operations return an accepted run identifier. The action invalidates only the affected view after a successful commit.

Proposed exceptional HTTP endpoints are deliberately small:

| Method and path | Purpose | Required behavior |
| --- | --- | --- |
| `POST /api/imports` | Receive a bounded resume upload | Authenticate, validate import kind and size/type, persist upload metadata, request parsing |
| `GET /api/runs/[runId]` | Poll an active run | Owner-scoped status and safe progress; private, uncached response |
| `GET /api/documents/[documentId]/download` | Download a particular artifact version | Verify ownership, resolve storage key internally, set safe disposition |
| `POST /api/integrations/[provider]/connect` | Start provider consent | Allowlisted provider and bound OAuth state; do not accept arbitrary callback URLs |
| `GET /api/integrations/[provider]/callback` | Complete provider OAuth | Verify state/PKCE as applicable, bind account to initiating owner |
| `POST /api/integrations/[provider]/disconnect` | Revoke local access | Invalidate credentials and cancel future provider work |
| `GET /api/health` | Process liveness | No account, database credential, provider, or document details |

These are proposed internal product contracts, not a promise of a public API. Authentication-library endpoints may have their own conventions. An endpoint inventory will be updated when authentication is selected.

`documentId` denotes an immutable `DocumentVersion` ID in this initial contract. Downloads require a validated `format=pdf|docx` query value and serve only the selected version's existing artifact; a mutable latest-version alias is not used for submitted files. A successful generation run can leave a document in `needs_review`; review status is independent of run status.

## 4. Application contracts

Every command receives an explicit trusted principal, validated input, request ID, and expected record version where concurrent edits matter. The browser cannot set its own owner ID or grant itself a worker identity.

| Use case | Important input | Outcome |
| --- | --- | --- |
| `ConfirmCareerFacts` | Draft version, accepted facts, expected version | New immutable profile version; conflicting edits reported |
| `SaveManualJob` | JD text, optional original URL, source metadata | Job and source snapshot; duplicate candidate returned when found |
| `RequestDiscovery` | Saved search version and enabled source configuration | Accepted run or existing request for the same idempotency key |
| `RequestJobAnalysis` | Job snapshot and profile version | Accepted analysis run, never an immediate model result |
| `RequestDocumentPackage` | Analysis, profile/JD versions, formats, voice settings | Accepted generation run or explicit budget/validation rejection |
| `RecordApplicationEvent` | Application, event, expected version | Audited state transition; no unsupported transition silently accepted |
| `ResolveMailMatch` | Event, selected application or dismissal | Audited association and recalculated projection |

Expected failures use a discriminated result: validation, unauthenticated, forbidden/not-found, conflict, budget exhausted, connection required, and provider temporarily unavailable. Logs contain a correlation ID and redacted error category. Browser responses do not contain provider error bodies or stack traces.

## 5. Durable command acceptance

Accepting work is a database operation, not an unawaited promise:

1. In one transaction, validate the owning records, insert a stable work request and run, and write an outbox record. A unique owner/request key deduplicates retries.
2. Commit before acknowledging acceptance to the browser.
3. A dispatcher publishes the outbox item to pg-boss using a stable job key. A reconciler retries undispatched items after a crash.
4. The worker claims the job, resolves its owner and current permissions, and checkpoints completed steps.
5. Persist results and step completion before acknowledgement. Outbox dispatch and consumption can repeat; result writes must remain idempotent.

pg-boss offers PostgreSQL-backed jobs, scheduling, transaction adapters, retries, and concurrency policies. Jobflow still treats external effects as at-least-once: a model request can complete before a process loses its response. Queue guarantees do not make an external API call exactly once. The pinned queue version and transaction API must be verified during implementation. [pg-boss documentation](https://pgboss.io/)

Never hold a database transaction open during a network/model call or document rendering. Record the attempt, perform bounded work, then commit a result using the stable step key. A repeated generation attempt may incur additional provider cost, so automatic retry rules distinguish known failures from ambiguous completion.

## 6. Runtime and operations

The initial topology is one web process, one worker, one PostgreSQL instance, and a private artifact directory. The same topology can run on the user's Mac or on an always-on host. A hosted web frontend alone does not run the worker. Filesystem storage requires a persistent volume shared by authorized processes; a later object-storage adapter can replace it without changing use cases. Self-hosting behavior must be tested against the selected deployment, rather than assumed to match a managed host. [Next.js self-hosting guide](https://nextjs.org/docs/app/guides/self-hosting)

Use UTC instants for events and an IANA timezone for schedules; `Asia/Seoul` is the proposed user default. On restart, enqueue at most one eligible missed daily run and record the missed window. Do not replay every missed occurrence. For DST zones, skip a nonexistent wall-clock slot and run only once for a repeated slot; expose this policy before enabling a schedule. Overlapping runs for the same owner/source are prevented by durable locks or unique active-request constraints.

A sleeping or powered-off Mac cannot meet an always-on execution guarantee. The local versus hosted runtime remains an approval decision. Runtime readiness must show worker heartbeat, last successful source sync, queue delay, failed steps, and connection health separately.

Application migrations are versioned and reviewed; pg-boss schema management is separate. Startup must detect incompatible schema versions. Release checks include migration on a clean database and upgrade from the preceding supported version. Recovery includes database plus artifact backups; copying the repository alone is not a data backup. [Drizzle schema and migration overview](https://orm.drizzle.team/docs/overview)

## 7. Approval items and implementation checks

Open choices: local or always-on execution; authentication mechanism; initial mailbox provider; AI provider/model and budget; shortlist-only versus all eligible jobs for document generation; artifact retention and export formats.

Before this proposal can be called implemented, verify owner isolation through every entry point, browser bundle boundaries, outbox recovery after enqueue failure, duplicate job delivery, concurrent edits, provider timeout handling, cancellation, migrations, and a restore of database plus artifacts. Neither mail sending nor application submission is part of this architecture's first release.
