# Workflows and Integration Design

Status: **Proposed — awaiting approval**  
Review date: **2026-11-05**  
All adapters and output formats below are planned; no connection or background schedule has been activated.

## 1. Execution model

The worker executes bounded steps, not one unrestricted prompt that controls the entire account. Deterministic code handles source identity, parsing limits, deduplication, authorization, state transitions, and persistence. AI produces typed proposals for semantic matching, visa-evidence extraction, and document wording. A proposal is validated before it changes product data.

The manual button and scheduler submit the same durable command. Each run records owner, trigger, saved configuration version, start/end times, step attempts, provider cursors, sanitized errors, and model usage. Run states are `queued`, `running`, `succeeded`, `partially_succeeded`, `failed`, or `cancelled`. User review is a separate document or email state, not a run state: producing a draft can complete a run successfully while that draft still needs review. A finalizer determines the result from persisted child steps, so a successful source is retained when another fails.

## 2. Career intake

An uploaded or pasted resume becomes a private source artifact. Extraction creates candidate facts with source spans; the user confirms or corrects those facts before they are usable in generated claims. A confirmed profile version is immutable. Later changes create another version rather than altering the evidence behind an existing document.

Capture role preferences, countries, seniority, remote/location constraints, language, and sponsorship preference separately from career facts. Unknown values remain unknown. Missing dates, metrics, or skills produce questions instead of fabricated completions. Resume parsing and document rendering have size, page-count, execution-time, and format limits to be selected during implementation.

## 3. Discovery and JD ingestion

Proposed first inputs are manual JD paste and a Greenhouse board adapter. Greenhouse's public GET API exposes published board jobs, including descriptions when requested. Its scope is a configured employer board, not worldwide job search. The user needs a target-company list or another discovery source to find new employers. [Greenhouse Job Board API](https://docs.greenhouse.io/job-board)

Later source adapters may support Lever and Ashby using their documented public posting APIs. Preserve source-specific identifiers and location/workplace fields instead of inferring a uniform meaning from similarly named flags. [Lever postings API](https://github.com/lever/postings-api), [Ashby public posting API](https://developers.ashbyhq.com/docs/public-job-posting-api)

LinkedIn job-alert emails can suggest candidates and employer links. They are not equivalent to a supported unrestricted LinkedIn search API. Jobflow will not automate LinkedIn login or scrape its authenticated interface in this proposal. Original employer pages are preferred for complete JD evidence. [LinkedIn job alerts](https://www.linkedin.com/help/linkedin/answer/a511279), [LinkedIn prohibited software guidance](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions)

Each source adapter returns bounded pages of normalized candidates plus a provider checkpoint. Fetches use allowlisted source adapters, timeouts, response-size limits, and rate-limit handling. A pasted arbitrary URL is not automatically fetched; generic URL retrieval needs an explicit SSRF-safe policy before implementation.

Persist source ID, canonical URL, original URL, fetched-at time, raw-source reference, normalized text hash, and source revision. Primary deduplication uses provider/board/posting ID. Cross-source matches are candidates based on canonical employer URL and requisition evidence; title/company similarity alone must not merge different jobs. A changed JD creates a new snapshot and marks dependent analysis stale. Only a complete successful board reconciliation can mark missing jobs as potentially closed.

Store a page's observations and checkpoint together. Do not advance a cursor before its observations are committed. If persistence fails, repeating the page must be safe. A source failure must not erase existing jobs or label them closed.

## 4. Analysis and sponsorship evidence

Analysis uses pinned profile, preference, and JD versions. Its result separates required criteria, preferred criteria, supported experience, missing evidence, and genuine gaps. Explain each recommendation; an aggregate score is optional and cannot silently exclude jobs with unknown sponsorship.

Visa labels are `supported`, `not_supported`, `conditional`, and `unknown`. Store the quotation or source span, URL, checked time, country/context, and whether the evidence concerns this posting or the employer. Employer sponsor history does not establish the current posting's policy. Contradictory or absent statements produce a visible review need. This is evidence classification, not a determination of legal eligibility.

The model receives only the necessary source excerpts and confirmed career facts. Treat JD and email contents as untrusted data, never as operational instructions. Structured output parsing checks enum values, record references, evidence spans, and profile-fact IDs. Invalid or unsupported output is rejected or routed to review; it is not silently repaired into a factual claim.

## 5. Document packages

Generating for selected jobs is the proposed default; generating for every eligible result remains an explicit configurable choice. Both obey daily limits and estimated-cost ceilings. Selecting a job creates or uses an application record and requests a package tied to that exact JD and profile revision.

The package pipeline selects supported experience, creates an outline, writes a draft, validates factual references, and performs a voice edit. Voice editing uses optional user writing examples and concrete preferences. A style skill can contribute versioned instructions, but cannot relax evidence checks. Flag repeated JD language, unsupported superlatives, generic enthusiasm, and invented metrics for revision.

Keep the editable draft, rendered artifact versions, prompt/template revision, provider/model, input hashes, validation findings, user edits, and approval state. Resume/CV length and sections follow the destination's requirements; do not automatically create two redundant documents. Cover letters are optional. PDF and DOCX exports are proposed and must pass extraction and visual-layout checks before release.

Rendering writes to a temporary object and finalizes an artifact with a checksum before committing the downloadable version. If a render fails, preserve the editable draft and show that the requested export is unavailable. Regeneration creates another version and never overwrites the user's edits. Approval marks the exact version reviewed; a new draft is not automatically approved or submitted.

## 6. Mailbox synchronization and application events

The first provider is still a user decision. Use a direct provider OAuth integration for a reproducible open-source installation. A ChatGPT/Codex connector may help development but is not a production dependency. App sign-in and permission to read a mailbox are separate grants. Read access does not include sending, modifying labels, deleting, or applying for jobs.

Provider consent requirements must be assessed before distribution. For example, Gmail lists `gmail.readonly` among restricted scopes, so a public integration cannot be described as production-ready merely because local OAuth works. Prefer the narrowest scope capable of the approved workflow and document any remaining verification requirements. [Gmail scope reference](https://developers.google.com/workspace/gmail/api/auth/scopes)

The user chooses a time window and relevant query/labels to limit what Jobflow processes. This is a product processing filter, not a claim that OAuth access itself is limited to those messages. Checkpoint commits follow the same page-and-cursor rule as discovery. An expired provider history cursor triggers a bounded rescan with provider-message-ID deduplication.

Ingest immutable events such as receipt, assessment invitation, interview invitation, offer, rejection, and withdrawal acknowledgement. Separate the observed message from the interpretation and resulting application projection. Match using provider message/thread IDs, requisition ID, role, employer, and known application details. Multiple applications at the same company remain distinct. Low-confidence links go to a review queue.

No response is not a rejection. Old messages arriving late cannot silently regress a user-confirmed stage. A manual override is an auditable event with precedence over conflicting inferred events until resolved. Disconnecting a mailbox disables new synchronization and future token use; retention or deletion of already imported events follows the user's data policy.

## 7. End-to-end sequence and recovery

For a document request: the Server Action validates the user and versions; one database transaction records the request, run, and outbox item; the dispatcher enqueues it; the worker generates and validates a draft; the renderer finalizes selected artifacts; the worker commits package versions and finishes the run; the open dashboard polls the owned run and refreshes the package view. Closing the page does not cancel accepted work.

| Failure | Required outcome |
| --- | --- |
| Provider rate limit | Honor retry guidance, back off with jitter, retain checkpoint |
| Model call has ambiguous completion | Record uncertainty; avoid unbounded automatic paid retries |
| OAuth revoked | Pause that integration and request reconnection; keep unrelated work running |
| Worker crash after result commit | Repeated delivery finds the completed step and does not duplicate records |
| Cancel requested | Stop before the next bounded step; retain completed results and usage |
| One source fails | Show partial success and identify the failed source |
| Budget reached | Stop new paid work; retain free collection and already produced drafts |

Validation must cover duplicate deliveries, interrupted pagination, changed JD versions, unsupported claims, contradictory visa evidence, same-company applications, out-of-order mail, token revocation, artifact failures, and schedule recovery. These scenarios are release acceptance criteria, not claims of existing test coverage.
