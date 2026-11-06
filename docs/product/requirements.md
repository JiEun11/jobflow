# Product requirements

**Status:** Proposed · **Date:** 2026-11-05

## 1. Problem and intended user

An international job search repeats the same work across many openings: discovery, eligibility checks, tailoring documents, remembering what was sent, and following scattered email responses. Jobflow should organize these steps around one verified career record and a clear application history.

The initial user runs a private single-owner instance. The public project should later be installable by other people with their own data and accounts. Development happens in an IDE; no IDE-specific capability is required to operate the product.

## 2. Confirmed requirements and proposed defaults

| Requirement | Status |
| --- | --- |
| Discover suitable jobs on a daily configurable schedule | Requested; exact time and execution host undecided |
| Use a base resume to analyze job descriptions | Requested; resume and target criteria not yet supplied |
| Produce application-specific resumes/CVs | Requested; automatic generation for all candidates versus selection-first remains open |
| Assess visa sponsorship evidence | Requested; target countries and visa constraints undecided |
| Track progress from email in a dashboard | Requested; mailbox provider and account access undecided |
| Optional cover letters without generic AI phrasing | Requested; writing samples optional and not supplied |
| Use TypeScript and Next.js-oriented frontend/backend architecture | Requested by the latest design instruction |
| English repository documentation and Korean user discussion | Confirmed |
| Orca as the development IDE; `JiEun11/jobflow` as the repository | Confirmed |
| Local-first self-hosted, one owner, PostgreSQL and separate worker | Proposed architecture, awaiting review |
| Selection-first document generation | Recommended default, not an accepted reduction of the requested all-job capability |
| English-first UI with later locale support | Proposed; documentation language does not determine UI language |

## 3. Product workflow

### Career source of truth

Import a resume or entered text. Preserve the source and present extracted facts for confirmation. Store roles, dates, skills, projects, outcomes, and metrics with source references. Unsupported or uncertain fields stay unresolved. Corrections create a new profile version; they do not silently rewrite the provenance of previously generated documents.

### Opportunity discovery

Search preferences include role families, countries, seniority, location/remote restrictions, exclusions, and sponsorship importance. Start with manual JD import and one public ATS adapter. Maintain an explicit list of company boards; add a search/discovery provider later if broader company discovery is needed. ATS APIs do not provide a complete worldwide search index.

Job-alert email can expand the set of discovered opportunities. Preserve source identity and canonical employer links, and separate newly discovered, changed, expired, and already reviewed openings. A missing sponsorship mention alone must not exclude a role.

### Explainable analysis and visa evidence

For each requirement, show supporting career facts, a gap, or a request for confirmation. A ranking can help order results, but must not hide reasons or act as the only filter.

Visa labels are `supported`, `not_supported`, `conditional`, and `unknown`. Every non-unknown label needs scoped evidence and a capture time. Employer sponsorship history is displayed separately from the opening's policy. Work authorization requirements, relocation support, and visa sponsorship are distinct fields. The product does not determine immigration eligibility or promise a visa outcome.

### Application documents

Choose an output profile appropriate to the employer request: concise resume, longer CV, or another explicitly supported template. Avoid producing two nearly identical files just because their labels differ. Preserve the user's option to request both.

Create editable structured drafts, then produce PDF/DOCX artifacts only after the renderer's acceptance checks pass. Each version records the profile, job snapshot, fact references, template, prompt/model metadata, and user edits. New analysis or generation creates a new version rather than overwriting the file actually used for an application.

An optional cover letter should connect specific relevant experience to the role. Use the user's writing samples when available. A final style pass removes filler, unsupported enthusiasm, repetitive JD wording, and invented achievements without changing verified facts. Skills or prompt recipes are versioned drafting inputs, not authority to execute external instructions.

### Application tracking and mail

Saving an opening does not mean applying to it. An application records intent, stage, submitted document versions, dates, and events. The user can mark submission and correct any stage.

Read connected mail incrementally and identify relevant events. Match using application identifiers, job details, sender context, and thread history. If multiple applications fit, show a review item. Distinguish a deadline, an interview invitation, a general recruiter message, and a marketing email. Preserve user corrections and the evidence behind derived state.

### Automation and control

Configure timezone-aware schedules, source limits, model budgets, and document-generation policy. Show last attempt, last successful sync, partial failures, pending review, and the next scheduled occurrence. Retry failed steps without duplicating successful effects. Pausing a schedule prevents new scheduled requests; cancellation of a running request is a separate control.

## 4. Application stage vocabulary

Stages: `interested`, `preparing`, `applied`, `assessment`, `interview`, `offer`, `rejected`, `withdrawn`.

Archiving is an independent `archivedAt` property. Collected-job status, document status, run status, and application stage are different state machines. Events may skip stages; a late or ambiguous email must not silently regress a user-confirmed state. Corrections remain auditable.

## 5. Initial non-goals

- Application submission, recruiter messaging, or email sending.
- Automated LinkedIn login or browser scraping.
- Automated legal eligibility decisions.
- Hosted multi-tenant SaaS, payments, and organization administration.
- Broad web crawling, arbitrary executable agent skills, and unbounded autonomous browsing.
- Guaranteed daily execution on a powered-off or sleeping local computer.

## 6. Acceptance criteria

| ID | Observable outcome |
| --- | --- |
| PR-01 | Importing a profile distinguishes extracted text from user-confirmed facts and supports correction before generation. |
| PR-02 | Importing the same source opening twice preserves one posting and the relevant immutable snapshots. |
| PR-03 | An analysis shows requirement-by-requirement support, gaps, and uncertainty with links to inputs. |
| PR-04 | A job without sponsorship text remains `unknown`; employer-level evidence cannot silently become job-level support. |
| PR-05 | Draft claims reference confirmed facts; an unsupported metric or employer/date change fails validation or enters review. |
| PR-06 | A regenerated document preserves earlier versions and records its exact source versions. |
| PR-07 | PDF/DOCX exports preserve readable text order, content, links, and acceptable page layout using synthetic fixtures. |
| PR-08 | A retry after a worker crash produces no duplicate application/document effects for the same task intent. |
| PR-09 | Mail about two roles at one company is not linked using company name alone; ambiguity appears in the inbox review queue. |
| PR-10 | User stage corrections remain visible and are not overwritten by a replayed older mail event. |
| PR-11 | A completed or partially failed run remains inspectable after browser and process restarts. |
| PR-12 | Unauthorized or cross-owner reads, mutations, run queries, and downloads are denied server-side. |
| PR-13 | The repository, sample mode, logs, test fixtures, and screenshots contain no real career, mailbox, or credential data. |
| PR-14 | A fresh contributor can follow one verified local setup path without a particular AI editor or ChatGPT connection. |

These criteria define release evidence to collect later; none is presented as a test already passed.

## 7. Decisions still needed

Before the relevant implementation slice, confirm target roles/countries/seniority, hard sponsorship requirements, mailbox provider, AI provider and spending limit, generation scope, UI locale, daily time/timezone, local versus always-on operation, and the intended open-source license. Architecture review can proceed without personal resume content or account access.
