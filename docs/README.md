# Jobflow design documentation

**Status:** Proposed · **Review date:** 2026-11-05 · **Language:** English

These documents describe a proposed system. They are not evidence that application code, integrations, schedules, or hosting have been implemented. User discussion remains in Korean; repository documentation is written in English.

## Reading order

| Document | Review question |
| --- | --- |
| [Requirements](product/requirements.md) | Are the intended behavior, scope, and success criteria correct? |
| [Experience](product/experience.md) | Can the user find, assess, prepare, and track an application clearly? |
| [Overview](architecture/overview.md) | Are process and package boundaries appropriate? |
| [Frontend](architecture/frontend.md) | Are rendering, state, feature ownership, and component boundaries explicit? |
| [Backend](architecture/backend.md) | Are entry points, use cases, authorization, and asynchronous work separated? |
| [Data model](architecture/data-model.md) | Can facts, evidence, document versions, and application events be traced? |
| [Workflows](architecture/workflows.md) | What happens on the happy path, ambiguity, retry, or partial failure? |
| [Privacy and security](architecture/privacy-security.md) | Where does private data live, and who can access it? |
| [Implementation plan](planning/implementation-plan.md) | What is delivered first, and what approval or evidence does each slice require? |
| [Quality strategy](planning/quality-strategy.md) | Which behaviors must be demonstrated before release? |
| [Source register](architecture/sources.md) | Which statements follow official documentation, and which are Jobflow design decisions? |

## Proposed decisions

- [ADR 0001: TypeScript, Next.js, and module boundaries](architecture/decisions/0001-typescript-nextjs.md)
- [ADR 0002: PostgreSQL and a durable worker](architecture/decisions/0002-durable-worker-postgresql.md)
- [ADR 0003: Private data and explicit identity](architecture/decisions/0003-private-data-and-auth.md)

All ADRs remain **Proposed** until approved. Approval is recorded through a subsequent documentation change; generating this document set does not accept its proposals.

## Document ownership and change rules

Requirements own product scope. Experience design owns routes and interaction states. The data model owns persistent vocabulary. Architecture documents own dependencies and runtime responsibilities. ADRs explain why a decision was chosen. The implementation plan owns delivery order and unresolved choices.

When a change affects more than one area, update the affected documents together. Do not silently change an application stage, route, package boundary, or execution guarantee in a single document. Examples and diagrams are illustrative, and must never contain actual user data.

## Canonical terms

- **Career fact:** a user-confirmed statement about experience, separate from extracted text.
- **Job posting:** the identity of an opening; a **job snapshot** preserves its description at a point in time.
- **Application:** a user's pursuit of a particular opening, separate from merely collecting it.
- **Evidence:** a scoped source statement with provenance and a capture time.
- **Document version:** an immutable content version linked to the profile, job snapshot, and generation inputs.
- **Task request:** a durable intent to perform asynchronous work.
- **Run:** an observable execution of that request, with steps and attempts.
- **Mail event:** a deduplicated observation from a provider message, subject to linking and review.
