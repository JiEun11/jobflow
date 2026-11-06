# Implementation plan and review gates

**Status:** Proposed · **Date:** 2026-11-05

## 1. Current boundary

The authorized deliverable is an English documentation set and a detailed README. No application source, package installation, OAuth connection, schedule, deployment, Git commit, or Git push is part of this documentation task.

All proposed architecture decisions remain open for review. This plan is ordered by working product slices, rather than creating every package and empty feature folder at once.

## 2. Delivery slices

| Slice | Scope | Evidence required to complete it |
| --- | --- | --- |
| D0 — Design review | Requirements, experience, architecture, data model, privacy, ADRs | Owner reviews the proposed direction and confirms the first implementation scope |
| D1 — Foundation and synthetic vertical slice | Pinned workspace, Next.js app, worker entry, PostgreSQL migrations, owner/session bootstrap, contracts, synthetic demo | A contributor can start the system; an authorized page reads a synthetic record; an action persists a change; an outbox request survives a restart and completes in the worker |
| D2 — Career facts and manual JD | Supported resume import, review/confirm facts, immutable profile/JD versions, source provenance | A synthetic candidate can correct extraction; unconfirmed facts cannot silently become evidence; a changed JD preserves the previous snapshot |
| D3 — Analysis and document review | One chosen AI adapter, requirement mapping, scoped visa evidence, editable document draft and optional cover letter | Unsupported claims enter review; schema/fact checks run independently of model text; regenerating preserves earlier edits and inputs |
| D4 — Exports and application records | Verified PDF/DOCX renderers, document approval/version history, explicit submitted package, application timeline | Export text and visual layout pass QA; the file recorded as submitted remains identifiable after regeneration |
| D5 — Discovery and durable scheduling | One ATS board adapter, target-board configuration, source cursor, daily schedule, budgets, cancellation and recovery | Duplicate and interrupted collection creates no duplicate posting; one failed source yields partial success; timezone and missed-run policy are demonstrated |
| D6 — Mail-driven tracking | One selected read-only mailbox adapter, incremental sync, message deduplication, event matching and review | Two roles at one company remain distinct; ambiguous and older events cannot overwrite a user correction; revoked consent stops only the affected integration |
| D7 — Self-hosting and open-source readiness | Container path, backup/restore, retention/delete/export, setup documentation, licensing and contributor materials | A fresh setup and a restore drill succeed; public artifacts contain synthetic data only; owner approves release readiness |

D1 must include a real durable task using synthetic data before AI or mailbox work. This tests the architectural seam early without waiting for private credentials. D3 can be designed with a deterministic fake adapter for tests; the UI must clearly state when a real AI provider is unavailable and must never show fake live results.

## 3. Decisions required before their dependent slice

| Decision | Recommendation or options | Needed by |
| --- | --- | --- |
| Architecture baseline | All-TypeScript Next.js web + Node worker + PostgreSQL | D1 |
| Initial execution profile | Local development first; choose an always-on host if laptop-off execution is required | D1 for setup assumptions; D5 for unattended guarantees |
| Auth/session implementation | Better Auth is the preferred proposal; review bootstrap and closed-registration behavior | D1 |
| Exact dependency versions | Pin compatible stable releases; inspect advisories and licenses; record Node/PostgreSQL compatibility | D1 |
| Target roles, countries, seniority, work arrangement | User-supplied criteria; no invented default profession or location | D2/D5 |
| Sponsorship constraints | Essential versus preferred, and countries/routes to investigate | D3 |
| Document language and output types | Resume/CV/cover letter choices and intended markets | D3/D4 |
| First AI provider/model and spending cap | One adapter initially; show what data is sent externally | D3 |
| Generation scope | Manual, shortlisted, or all eligible discovered jobs; selection-first is recommended but unapproved | D3/D5 |
| UI locale and writing voice | English-first is proposed; Korean UI and user writing examples remain open | D1/D3 |
| Daily time, timezone, limits, catch-up behavior | User-selected local time; timezone explicit in UI and stored as IANA zone | D5 |
| First mailbox provider and account | Gmail or Outlook after user selection; exact read scopes and consent requirements reviewed | D6 |
| License and project release policy | Owner chooses before announcing an open-source release | D7 |

An unresolved choice blocks only its dependent work, not unrelated approved documentation or implementation. Architecture approval does not authorize reading email or uploading a resume to an external model without the applicable account setup and informed configuration.

## 4. Foundation detail

After approval, create only the packages needed by D1, with real exports and enforced dependency boundaries. Pin the package manager and runtime, commit the lockfile, and define documented scripts for development, type checking, linting, tests, build, migration, and worker startup.

The foundation must specify separate migration ownership for application tables and the queue system, a private data path outside the checkout, and a single owner bootstrap flow. Local setup includes PostgreSQL through a reproducible container configuration, plus an existing-database option. Do not require a particular IDE or paid platform connection.

Before exposing a non-loopback instance, finish the authentication/origin/TLS deployment checks. Before using a source or provider, verify its current API, required permissions, and account availability. Do not prebuild unused providers or a general plugin framework.

## 5. Change and migration policy

Use reviewed, additive migration files. Test both a fresh database and an upgrade from the previous supported schema. Applied migrations are immutable. Destructive data transformations need a separate migration plan, backup, and recovery procedure.

Version serialized task payloads. A new worker must either support in-flight payload versions or drain them deliberately before deployment. Schema and provider changes must not reinterpret historical document provenance or application events.

Keep architecture documents aligned with changed implementation decisions. If an ADR is rejected or superseded, retain its context and link to the replacement. Update the README when a capability changes from planned to available, and provide the evidence rather than simply removing the design disclaimer.

## 6. Completion standards

Each slice delivers a user-visible workflow, relevant failure states, privacy boundaries, focused tests, and updated documentation. Avoid claiming operational readiness from a successful build alone. Use the [quality strategy](quality-strategy.md) and the acceptance IDs in [requirements](../product/requirements.md).

The first real-data pilot should be a small, manually checked set of user-chosen jobs. Compare recommendations and documents against the original sources before enabling wider scheduled processing. Daily automation is enabled only after its sources, write path, limits, and restart behavior have been exercised.
