# Roadmap

The [requirements](../product/requirements.md) define acceptance criteria. Only the local Phase 1 app is implemented. A new external connection, scheduled run, deployment, or publication requires owner authorization.

| Slice | Scope and exit evidence |
| --- | --- |
| Phase 1 · Local foundation | Owner session, structured versioned profile, private PDF, dashboard. The [runbook](phase1-local.md) links the verification commands. |
| Phase 2 · Discovery and scheduling | Manual JD intake and one approved ATS adapter. Prove a synthetic durable task before live collection. Validate deduplication, checkpoint replay, failure isolation, missed runs, budgets and cancellation. |
| Career intake and analysis | Extract facts into a review queue when a parsing path is approved. Pin profile and JD revisions. Verify claim grounding, conflicting sponsorship evidence and stale-result handling. |
| Documents and applications | Produce editable drafts and optional cover letters, verify PDF/DOCX text order and layout, and pin the exact approved or submitted package. Track application state separately. |
| Mail and release | Choose one read-only OAuth provider, prove ambiguous matches and revocation, then rehearse backup/restore, retention, export and release. |

## Phase 2 contracts to validate

- **Source identity** uses provider, board and posting ID. Keep original and canonical URLs. Persist each observed page with its cursor. Store immutable JD snapshots keyed by content digest. A failed or partial scan cannot close postings.
- **Work acceptance** persists a request and outbox entry before dispatch. The manual trigger and scheduler submit the same command. Version payloads, use logical idempotency keys for replays, persist step results, and expose partial success. Test crashes before and after publication and result commit. Honour provider limits, stop new paid work on budget exhaustion, and treat ambiguous paid calls as uncertain.
- **Scheduling** stores the timezone and local time, with one logical key per occurrence. Demonstrate recovery and visible last attempt, last success, and next occurrence. Choose the first source and employer list, execution host, and missed-run policy before activation. Greenhouse is a candidate per-employer source. Lever and Ashby are candidates for later adapters. [Greenhouse API](https://docs.greenhouse.io/job-board) · [Lever API](https://github.com/lever/postings-api) · [Ashby API](https://developers.ashbyhq.com/docs/public-job-posting-api)

## Later design boundaries

Pin source revisions and confirmed supporting facts to each analysis and generated document. A changed input marks dependent work stale. A new edit requires fresh approval without changing prior approvals or the package actually submitted. Use source-scoped evidence for sponsorship. Store worker, application, document-review, posting, and mail-link states independently.

Mail sync uses provider-scoped message IDs and atomic cursor checkpoints. Match by requisition or job and thread evidence, send uncertainty to review, and preserve user corrections against delayed messages. Use provider references and minimal excerpts by default. Validate OAuth scope and consent requirements before distribution.

Keep performance and accessibility checks on the real user path. On mobile, retain explicit navigation and full-page detail views. Show empty, failure, and partial states distinctly. Use synthetic fixtures until real-data processing is authorized. Begin a real-data pilot with a user-selected small batch and manually verify source claims before widening automation.

Open decisions include seniority/work arrangement, sponsorship requirements, AI provider and spending cap, generation scope, mailbox provider, UI and document language, retention, and license. Settle each before its dependent slice.
