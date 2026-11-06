# ADR 0002: Use PostgreSQL and an independent durable worker

- **Status:** Proposed
- **Date:** 2026-11-05

## Context

Collection, model calls, document generation, and mailbox synchronization can outlive an HTTP request. Users need observable retries, partial results, and work that survives a closed browser. A future self-hosted instance should run without a particular desktop app. The product still needs a manageable installation footprint.

## Decision

Use PostgreSQL as the initial application database, Drizzle for application schema/migrations, and pg-boss behind a queue port. Run dispatch, scheduling, and consumers in an independent Node.js worker. Reuse one database service for product records and queue infrastructure, with separate schema ownership.

Persist a task request/outbox entry transactionally before attempting queue publication. A dispatcher reconciles pending publication; stable logical keys and application uniqueness constraints protect effects on replay. Treat external effects as at least once or uncertain rather than promising universal exactly-once execution.

The proposed deployment has two application processes, not separately versioned microservices. The web and worker share the application core. A local host must be available to run local schedules; an always-on deployment is a separate hosting decision.

## Alternatives

| Alternative | Assessment |
| --- | --- |
| SQLite plus a custom scheduler/queue | Fewer local services, but implementing persistent coordination, retries, and cross-process recovery becomes Jobflow's responsibility |
| PostgreSQL plus Redis/BullMQ | A viable queue ecosystem, but adds a second state service to operate before it is required |
| Hosted-only workflow provider | Can reduce operational work, but introduces account/vendor coupling for self-hosted users; may be added as an adapter later |
| In-memory timers or work started inside a request | Does not provide the required restart and delivery guarantees |
| Desktop AI scheduled tasks as the only runner | Useful as an optional integration, but does not provide a portable standalone open-source runtime |

## Consequences

Local contributors must run PostgreSQL, preferably through a documented container setup. Database migrations, queue compatibility, backups, process health, cancellation, and missed schedules become explicit operational requirements. This proposal does not offer SQLite as a second supported dialect or pretend migration between databases is automatic.

The outbox adds a small reconciliation mechanism, but makes the accepted-request boundary clear. A compatibility spike in the foundation slice must demonstrate the pinned Drizzle/PostgreSQL/pg-boss versions, duplicate delivery behavior, and crash recovery before real paid or mailbox work is enabled.

## References

- [Next.js backend-for-frontend caveats](https://nextjs.org/docs/app/guides/backend-for-frontend)
- [Drizzle overview](https://orm.drizzle.team/docs/overview)
- [pg-boss source and documentation](https://github.com/timgit/pg-boss)
