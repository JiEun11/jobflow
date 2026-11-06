# Quality and verification strategy

**Status:** Proposed · **Date:** 2026-11-05

This document specifies future implementation checks. No application tests have been run because the application is not implemented. Documentation validation is a separate activity: English-only authored content, working local links, consistent terms, and an explicit distinction between proposals and shipped behavior.

## 1. Test at the behavior boundary

| Boundary | Proposed tool or environment | Meaningful evidence |
| --- | --- | --- |
| Domain and application rules | Vitest, injected ports, deterministic clock | Correct stages, factual references, visa scope, budget decisions, stale-input handling |
| Runtime contracts | Vitest and representative malformed inputs | Unknown input rejected, stable errors, no trusted type assertions around provider/model data |
| Database/repositories | Real disposable PostgreSQL | Ownership constraints, uniqueness, transaction rollback, revision conflicts, migrations |
| Durable execution | Real PostgreSQL and queue adapter | Accepted requests survive process failure; replay does not duplicate effects; publication failures reconcile |
| Interactive UI | Component tests for browser islands | Form errors, keyboard behavior, pending/conflict states, accessible labels |
| Full Next.js routes and RSC | Playwright against a running application | Authenticated server rendering, direct action checks, navigation, downloads, and end-to-end workflows |
| Provider adapters | Synthetic recorded payloads and controlled HTTP server | Pagination, rate limits, changed payloads, cursor expiry, revoked credentials, timeouts |
| Documents | Renderer integration tests, extracted text, page images | Content and reading order match the approved draft; layout and links are usable |

[Vitest](https://vitest.dev/guide/) is the proposed unit/integration runner; [Playwright](https://playwright.dev/docs/intro) is the proposed browser runner. Async Server Components are verified through the running Next.js application, not assumed to behave like ordinary client components in a unit renderer.

## 2. Golden-path product scenario

Use a clearly synthetic candidate, two distinct roles at the same fictional employer, and an unrelated role. The candidate imports a resume, confirms facts, imports a JD, reviews requirement matches, inspects uncertain visa evidence, edits a generated draft, approves a version, exports it, explicitly records submission, and resolves an ambiguous email event.

Assert that the submitted artifact remains linked after a newer document version is generated. Assert that employer-level sponsorship evidence never becomes a role-specific promise. Displayed counts must come from the correct owner and time window.

This scenario must also work without credentials using clearly labeled demo/test adapters. Production screens must not silently fall back to those adapters when a real integration fails.

## 3. Failure and recovery scenarios

- Crash after task intent commits but before queue publication: a reconciler publishes the pending request.
- Crash after a result commits but before the queue acknowledges completion: replay finds the committed result.
- Interrupt source pagination: resume or bounded resync preserves deduplication and does not mark unseen jobs closed after an incomplete scan.
- Deliver the same email twice or out of order: events deduplicate and a user-corrected stage remains protected.
- Change a profile or JD during generation: the output retains its actual input versions and is marked stale when appropriate.
- Receive provider throttling, revoked consent, or a malformed model result: retain independent successes and explain the affected step.
- Reach a budget limit: no new paid operation starts; remaining eligible work is deferred visibly.
- Render one document format unsuccessfully: preserve the successful draft/artifacts, and expose the failed format for retry.
- Restart after missed schedule occurrences: apply the documented catch-up policy without a replay storm.
- Cancel while a bounded provider call is running: stop at the next safe boundary, preserve committed work and actual usage.

External requests can complete even when their response is lost. Tests should demonstrate the chosen policy for uncertain paid calls; they must not claim universal exactly-once effects.

## 4. Security-focused checks

Test direct Server Action and Route Handler access, forged record IDs, cross-owner references, expired sessions, cross-origin mutations, OAuth state mismatch, and unauthorized artifact downloads. Verify that a local network request does not automatically acquire the owner identity.

Use malicious synthetic JD/mail instructions, private-network URLs, redirect chains, oversized files, invalid document signatures, and raw HTML. Assert that imported text cannot request tool execution, exfiltrate secrets, or create unverified career claims. Inspect built client bundles and redacted logs for synthetic secret markers and private DTO fields.

Shared cache leakage tests are mandatory before introducing persistent caching for owner data. Dependency boundaries should be linted or checked statically so browser imports cannot reach database, token, or provider modules.

## 5. Writing quality and export evaluation

Maintain a small synthetic evaluation set with verified facts and deliberately tempting unsupported metrics. Assess factual fidelity, relevance to the JD, missing-fact handling, repetition, and concise phrasing separately. A style score cannot override a failed factual check.

Keep provider/model/prompt/template versions with evaluation results. Human review is required for the real-data pilot; no test can certify that prose is universally indistinguishable from human writing. For resume/CV exports, verify text extraction, reading order, selectable text, headings, links, page breaks, overflow, and the absence of unexpected decorative content.

## 6. Proposed CI and release evidence

Once code exists, pull requests should run type checks, import-boundary rules, lint, focused unit tests, relevant database tests, a production build, and the critical browser workflow. Migration changes add fresh-install and upgrade checks. Provider-independent CI must not need real mailbox credentials or spend AI credits.

Before release, verify a clean installation, closed-registration owner bootstrap, disconnect/delete/export behavior, backup/restore with artifact digests, and container operation using the documented commands. Confirm the license and dependency notices, synthetic public materials, current security patches, and user-facing limitations. Record actual outcomes and unresolved limitations in the release notes.

Numerical coverage targets are not the primary gate. A small set of convincing failure/recovery and ownership tests is more valuable than tests that merely repeat implementation details.
