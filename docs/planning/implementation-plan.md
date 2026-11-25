# Roadmap

The [requirements](../product/requirements.md) define acceptance criteria. Phase 1 is verified locally. Phase 2A implements the Greenhouse pilot and cloud configuration. Cloud readiness remains subject to the [deployment and activation gates](phase2a-cloud.md).

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

## Phase 2 minimum implementation proposal

The approved Phase 2A uses a finite GitHub Actions run and a PostgreSQL lease rather than an always-running worker, and implements Greenhouse first. The broader proposal below remains useful for later source adapters and durable workflows.

Start with an owner-managed list of employer boards. Use public HTTPS listing APIs from the worker and restrict requests to approved provider hosts and validated board identifiers. Coverage is limited to configured employers. Each adapter returns normalized posting identity, title, employer, locations and workplace type, original URL, plain-text JD, and a checkpoint or completion marker. Treat provider text and links as untrusted input.

| Adapter | Minimum behavior |
| --- | --- |
| [Greenhouse](https://docs.greenhouse.io/job-board) | Read the configured board's jobs with `content=true`. Use the posting ID and normalize the returned location and JD. Validate the response total before reconciling a full inventory. |
| [Lever](https://github.com/lever/postings-api) | Use JSON, the configured global or EU site, and bounded `skip`/`limit` pages. Use the posting ID and retain country, secondary locations, and workplace type when present. |
| [Ashby](https://developers.ashbyhq.com/docs/public-job-posting-api) | Read the configured public board and include only listed postings. Use the validated canonical job URL as the source key when the payload lacks an explicit posting ID. Read structured primary and secondary locations where provided. |

**Eligibility and ordering.** Include roles with explicit Canadian location or remote eligibility for Canada. If country is unclear, mark the posting for review and exclude it from default results. Match normalized Full Stack titles and Frontend titles with React evidence in the title or job requirements. Preserve the evidence behind the match. Rank explicit Vancouver, British Columbia first, then other Metro Vancouver locations, then other eligible Canadian postings. Resolve Vancouver against province or country evidence to avoid promoting Vancouver, Washington. Break ties by recency and stable posting identity.

**Storage.** Reuse PostgreSQL for configured sources, postings, immutable JD snapshots, and run state. Enforce uniqueness on provider, board, and source posting key. Append a JD snapshot only when the normalized title, location, or JD changes. Key observations idempotently so replay preserves snapshot history, including a change back to earlier content. Keep cross-provider matches separate unless a stable employer requisition key or the same employer posting URL confirms the match. Reconcile missing postings only after a complete successful inventory.

**Execution.** Prove one synthetic durable request through the existing worker/outbox design, then validate manual Greenhouse collection, then add Lever and Ashby using the same fixture contract. Run daily at **09:00 Asia/Seoul** after approval. Persist a unique key per scheduled local date and resolve that occurrence to UTC. Proposed missed-run policy is one catch-up for the current Seoul date after 09:00. Confirm the host, approved boards, and catch-up policy before activation.

**Retries and logs.** Bound timeouts, response size, pages, and retries per source. Retry timeouts, rate limits and transient server errors with backoff and jitter, honoring `Retry-After`. Surface invalid board configuration and incompatible payloads for review. Persist run and source status, attempts, counts, checkpoint, next retry, and sanitized errors. Keep successful sources visible after a partial failure and omit raw payloads, JD bodies, and secrets from logs. Use fixtures to verify location and role decisions, pagination, duplicate delivery, changed JDs, partial failures, crash recovery, and scheduled occurrence uniqueness before enabling live collection.

## Later design boundaries

Pin source revisions and confirmed supporting facts to each analysis and generated document. A changed input marks dependent work stale. A new edit requires fresh approval without changing prior approvals or the package actually submitted. Use source-scoped evidence for sponsorship. Store worker, application, document-review, posting, and mail-link states independently.

Mail sync uses provider-scoped message IDs and atomic cursor checkpoints. Match by requisition or job and thread evidence, send uncertainty to review, and preserve user corrections against delayed messages. Use provider references and minimal excerpts by default. Validate OAuth scope and consent requirements before distribution.

Keep performance and accessibility checks on the real user path. On mobile, retain explicit navigation and full-page detail views. Show empty, failure, and partial states distinctly. Use synthetic fixtures until real-data processing is authorized. Begin a real-data pilot with a user-selected small batch and manually verify source claims before widening automation.

Open decisions include seniority/work arrangement, sponsorship requirements, AI provider and spending cap, generation scope, mailbox provider, UI and document language, retention, and license. Settle each before its dependent slice.
