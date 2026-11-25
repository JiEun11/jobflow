# System architecture

## Running system

A loopback-only Next.js App Router app serves the dashboard, editor, and authenticated route handlers. Better Auth provides sessions. PostgreSQL stores application records. Drizzle owns the application schema and migrations. A private filesystem directory outside the checkout stores PDF bytes.

The Phase 2A implementation adds a Vercel production mode with HTTPS and Neon PostgreSQL 18. Preview access and cloud PDF storage are disabled. A bounded GitHub Actions CLI invocation replaces the proposed long-running worker for initial Greenhouse discovery. The [cloud runbook](../planning/phase2a-cloud.md) records the independent migration, deployment and activation gates.

| Location | Responsibility |
| --- | --- |
| `apps/web/src/app` | Server-rendered pages and HTTP entry points |
| `apps/web/src/features` | Interactive UI for sessions, profile, and resumes |
| `apps/web/src/server` | Owner resolution, HTTP limits, and private file operations |
| `packages/core` | Framework-independent profile contracts and input validation |
| `packages/db` | PostgreSQL schemas, migrations, transactions, and owner-scoped queries |

Routes and pages resolve a verified owner. Queries scope private records by that owner. Client components receive only the data needed by the screen and do not import database or credential modules. Private responses avoid shared caching. See [privacy and security](privacy-security.md).

## Data and change boundaries

The [Drizzle schema](../../packages/db/src/schema.ts), [SQL migrations](../../packages/db/migrations), and [integration tests](../../tests/phase1.test.mjs) describe current behavior. Each profile revision holds structured sections. Version writes check the last observed revision and append an immutable row. Restoring an earlier version creates a successor with its source revision. A resume row identifies its owner, opaque storage ID, digest, and deletion state. The [local runbook](../planning/phase1-local.md) describes the storage lifecycle.

Keep applied migrations immutable. For schema changes, verify clean installation and upgrades from the previous supported schema. Preserve owner scope on cross-record references, using composite keys where practical. A destructive migration requires a reviewed backup and recovery plan.

## Decisions and scope

- [ADR 0001](decisions/0001-typescript-nextjs.md) covers TypeScript and Next.js feature boundaries.
- [ADR 0003](decisions/0003-private-data-and-auth.md) covers owner identity and private storage.
- [ADR 0002](decisions/0002-durable-worker-postgresql.md) proposes the PostgreSQL-backed worker for Phase 2. [The roadmap](../planning/implementation-plan.md) defines the evidence needed before scheduled collection.

Add packages or infrastructure when a real vertical slice needs them. Product outcomes and limits are defined in the [requirements](../product/requirements.md).
