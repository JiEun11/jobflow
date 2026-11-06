# Product Experience and Screen Design

Status: **Proposed — approval required**  
Reviewed: **2026-11-05**  
Scope: the planned first product experience. All screens below are design specifications, not implemented features.

## 1. Product promise and interaction model

Jobflow helps a candidate find relevant jobs, inspect evidence, prepare truthful application documents, and follow an application through its outcomes. The primary journey is:

**Confirm career facts → discover jobs → inspect fit and visa evidence → prepare documents → review → record application → review email updates.**

The user remains able to correct facts, reject recommendations, edit drafts, and override an application stage with a recorded reason. Application submission and outbound email are outside the first version. Saving a job or generating a document must never imply that an application was submitted.

English is the proposed first UI language. Visible strings and formatting are kept separate from business logic so Korean can be added without changing contracts. Store timestamps in UTC and display them in the user's selected timezone; schedules show their timezone beside the time.

## 2. Information architecture

| Destination | Main question | Primary action |
| --- | --- | --- |
| Today (`/`) | What deserves my attention today? | Review next task |
| Profile | Which career facts and search preferences are confirmed? | Review facts |
| Jobs | Which opportunities should I consider? | Inspect job or shortlist |
| Applications | Where is each application now? | Open application timeline |
| Documents | Is this package ready to use? | Review and export |
| Inbox review | Which email updates need my decision? | Confirm or correct association |
| Automation | What ran, and what failed? | Inspect or retry a run |
| Settings | What does Jobflow know and have access to? | Edit profile, criteria, connections |

Documents are reached from a job or application; the initial sidebar need not include a separate document library. Onboarding is a guided route that reuses profile and connection settings rather than a separate data model.

Desktop uses a stable left navigation, a main workspace, and contextual detail panels. On small screens, navigation collapses into a labeled menu and detail panels become full pages. No essential workflow depends on hover or dragging.

The proposed visual direction is a quiet workbench: neutral surfaces, one blue primary action color, compact evidence tables, and ample reading space for JD/document comparison. Start with a system sans-serif font, a 16px body baseline, a 4px spacing unit, a roughly 224px desktop navigation rail, and a content area capped near 1440px. Layouts adapt around 640px and 1024px according to content rather than device names. Implement these as semantic tokens, not repeated component literals. Warning, failure, success, and uncertain states remain distinct from selection styling. Charts and decorative imagery are unnecessary for the initial task flow.

## 3. Onboarding and profile

Onboarding collects target roles, locations, seniority, work arrangement, visa preference, document language, and schedule timezone. Resume upload or pasted text creates extracted career facts marked **Needs review**. The user confirms employer names, dates, skills, and metrics before they become evidence for generated documents.

Connection steps are optional and explain their immediate effect. A user can paste a JD and exercise the review workflow before connecting mail or AI. Without an AI connection, generation is visibly unavailable rather than simulated. A synthetic demo is a separate, clearly labeled mode; demo records cannot be mistaken for live results.

## 4. Dashboard and discovery

Proposed dashboard wireframe:

```text
Navigation | Dashboard                   Last discovery: time / status
           | Needs your attention: document review, ambiguous mail, deadline
           | Today's candidates: role, location, fit explanation, visa status
           | Active applications: stage, last event, next action
           | Automation: successful sources / failed sources / next run
```

Counts reflect stored records and clearly state the relevant time window. An unsuccessful collection displays **Collection failed**, not “0 new jobs.” The latest successful run and the latest attempted run are separate values.

Jobs support URL-backed filters for location, seniority, work arrangement, visa category, shortlist state, and freshness. The list presents source and last verification time. A fit explanation distinguishes requirements that are supported, missing, or unverified. A numeric ranking, if introduced, must expose its rubric and must not be presented as the probability of receiving an offer.

Proposed job detail wireframe:

```text
Role / Company / Location              Original posting ↗
Source freshness / Job state          Save | Prepare documents
Tabs: Overview | Fit | Visa evidence | Documents
Main: requirements and career evidence
Side: unresolved questions, source links, next action
```

Visa categories are **Support stated**, **Sponsorship explicitly unavailable**, **Conditional**, and **Needs verification**. Each assessment shows its evidence source and date. Company sponsorship history is a separate section. Silence in a JD remains unverified and does not automatically exclude the job. Missing source content or a stale assessment produces an explicit warning state without manufacturing a determination.

## 5. Document preparation and review

Before manually enqueueing generation, the user sees the selected job, profile version, requested document types, and unresolved facts. Scheduled generation uses an explicitly saved policy and pinned input versions, then places produced drafts in the review queue. Generation policy is configurable as manual, shortlisted jobs, or all eligible discovered jobs; the default remains an approval decision. When a configured budget or run limit is reached, the remaining work is labeled deferred.

Proposed review workspace:

```text
Job / Package version                State: Draft / Needs review / Approved
Requested outputs: Resume | CV | Cover letter
Left: JD requirement and selected career evidence
Right: editable document preview
Review: unsupported claims / missing facts / formatting issues
Actions: Save revision | Regenerate selection | Approve | Export
```

Resume/CV length and format follow the configured market and posting requirements. Cover letters are opt-in. A voice profile can store user-approved writing examples and editing preferences. The review panel checks for invented claims, unsupported metrics, repeated JD language, and generic praise; it does not claim to certify that text is “AI-free.”

Regeneration creates a new version and preserves manual edits in the earlier one. Historical approval remains tied to the exact reviewed document version. Later edits create an unapproved successor; a changed JD/profile marks the existing package stale for future use without deleting its approval or submission history. Export availability reflects actual rendering success; a missing PDF is not hidden behind a working text preview.

## 6. Applications and email review

The application view offers a table first, with an optional board using the same records. Canonical stage values are `interested`, `preparing`, `applied`, `assessment`, `interview`, `offer`, `rejected`, and `withdrawn`, displayed as human-readable labels. Archiving is a separate `archivedAt` field and does not replace the stage. A job shortlist is separate from these stages. An application in `interested` or `preparing` remains unsubmitted; the user records submission explicitly, including the job and document package used.

Each application has an event timeline with source, timestamp, actor, and next action. An email event can suggest a stage change and attach a deadline, but a generic company message cannot create an application or overwrite a confirmed stage. Matching considers application/job identifiers, role, sender, and thread context. Ambiguous events enter Inbox review with candidate associations and a visible reason for uncertainty.

Inbox review supports **Confirm association**, **Choose another application**, **Ignore**, and **Correct event type**. Original mail is linked through the provider when possible. The dashboard stores a minimal relevant excerpt rather than reproducing a full mailbox. Disconnection leaves prior event history readable and clearly marks synchronization as stopped.

## 7. Cross-screen state and accessibility requirements

| Condition | Required presentation |
| --- | --- |
| First use | Explain the next useful step without fabricated records |
| Filtered empty | Preserve filters; offer clear/reset controls |
| Loading | Local skeleton or pending label; preserve existing content |
| Queued/running work | Persisted run status, latest update time, navigation remains usable |
| Partial failure | Show usable results and identify failed sources or artifacts |
| Disconnected provider | Explain the affected capability and offer reconnect |
| Conflict/stale revision | Preserve edits and offer refresh/compare rather than silent overwrite |
| Recoverable error | Safe message, retry where safe, correlation identifier |

Status labels use words and icons as well as color. Forms have visible labels, field errors, and an error summary when needed. Dialogs trap and restore focus; notices announce meaningful updates without announcing every poll. Tables keep proper headers and have an accessible small-screen alternative. All actions work by keyboard, including application-stage movement. The interface respects reduced motion and readable contrast.

Experience acceptance is demonstrated with one synthetic candidate completing onboarding, job review, document revision, explicit application recording, and an ambiguous email correction. It must also demonstrate a failed source, a disconnected provider, and a stale document package. No live credentials or personal data are required for that demonstration.
