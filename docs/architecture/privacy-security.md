# Privacy and Security Design

Status: **Proposed — pending implementation approval**  
Design date: **2026-11-05**

Jobflow handles career history, private correspondence, generated application documents, and access to third-party accounts. This document records required boundaries and verification work. It does not claim that authentication, encryption, provider verification, or compliance review has been implemented.

## Assets and trust boundaries

The browser, imported documents, job descriptions, email content, external URLs, and AI responses are untrusted inputs. The Next.js server and independent Node worker enforce application policy; PostgreSQL and the artifact store hold private records. AI and email providers are separate data recipients with their own retention and access policies.

The proposed first deployment is one owner on one installation. A local installation binds to loopback and creates a bootstrap owner/session through an explicit setup flow; registration closes after bootstrap. A request is never treated as the owner merely because it reaches localhost. Exposing the service beyond that boundary requires reviewed authentication, TLS, trusted-origin configuration, and explicit account provisioning. [Better Auth](https://better-auth.com/docs/introduction) is the preferred proposed authentication/session adapter; the exact setup remains an architecture-decision gate.

## Identity, authorization, and server boundaries

Resolve a verified principal at every Server Action and Route Handler. Authorize again in the application/data-access operation using the target record's owner. Workers receive a persisted owner-scoped task and validate its references before execution. Do not use a caller-supplied owner ID as authentication or rely only on navigation, a layout, or proxy checks.

Keep database, credential, and integration modules server-only. Return minimal DTOs to Client Components; never serialize database models or connection records wholesale. Server Actions are externally callable entry points and require validation and authorization. These boundaries follow the official [Next.js data-security guidance](https://nextjs.org/docs/app/guides/data-security).

Application sign-in and permission to read a mailbox are separate flows. The first mail provider and exact read-only OAuth scopes are still undecided. Request no sending or mailbox-modification scope for the proposed feature set. Public distribution may introduce provider consent/verification requirements; assess these after selecting the provider rather than promising that a development connection is ready for all users.

OAuth callbacks require state validation, appropriate PKCE handling, trusted redirect destinations, and owner-bound connection creation. Store refresh credentials encrypted behind a credential adapter; obtain its encryption key from protected runtime configuration or an operating-system credential store. Keep the key separate from database backups. No secret belongs in a `NEXT_PUBLIC_*` variable, URL, browser storage, repository example, or application log.

## Imported content and outbound requests

Initial ingestion should support manual JD text and known public ATS endpoints. General-purpose URL fetching is disabled until it has a bounded policy. When introduced, allow only intended HTTPS destinations, reject private/loopback/link-local and metadata-service targets, resolve and validate addresses at connection time, and recheck every redirect. Set redirect, response-size, content-type, and timeout limits. URL parsing alone is insufficient; network-level restrictions complement validation. See the [OWASP SSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

Parse HTML into normalized text or sanitize it before rendering. Do not pass raw job or email HTML into `dangerouslySetInnerHTML`. Validate upload size and file signatures, allow only supported document types, generate opaque storage keys, and run document extraction with bounded resources. Attachment execution, macros, remote document assets, and automatic archive expansion are outside the initial feature set.

Authenticated downloads resolve an artifact ID to an owner-authorized storage key. User-controlled filenames cannot select a filesystem path. Use attachment disposition, a safe media type, private cache headers, and no public static directory for resumes or generated documents. A future object-store adapter must provide equivalent authorization and bounded download access.

## AI isolation and document integrity

JD and email text can contain instructions intended to redirect an AI workflow. Treat such text as evidence only. Analysis calls receive a narrow task and delimited source data, without tools, credentials, arbitrary URL access, or permission to change settings. Parse responses into versioned schemas and independently validate fact references, visa scope, and permitted state changes. Prompt wording alone is not the control boundary. This design is informed by [OWASP's prompt-injection guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).

Generation may rephrase confirmed career facts but cannot invent employers, dates, skills, outcomes, or metrics. Unsupported claims are blocked or returned for user review. Visa conclusions require traceable evidence, and ambiguous email matching cannot update a recruitment stage automatically. A style skill is reviewed prompt content, not executable instructions downloaded from an arbitrary package.

Before an external AI call, send only the fields needed for that operation. Let the user inspect the selected provider, model, expected data categories, and budget policy. Provider processing and retention are documented explicitly; local storage does not mean inference remains on the device. Do not assume an API key or subscription grants identical privacy guarantees across providers.

## Retention, cache, and operational access

- Store private runtime data outside the Git checkout. Public examples, screenshots, test fixtures, and issue reports use synthetic data.
- Log operation IDs, counts, duration, and sanitized error classes. Exclude resumes, message bodies, tokens, authorization headers, signed links, and raw model prompts/responses by default.
- Avoid shared framework/CDN caching for owner data in the baseline. Responses containing correspondence or documents use private/no-store policies. Any later cache is explicitly scoped and tested for cross-owner leakage.
- Record operator actions that change connection state, delete data, or override application status. Keep audit metadata useful without duplicating sensitive content.
- Disconnecting a provider stops new work and removes local credentials; request upstream revocation when supported. Deletion cannot promise immediate erasure from third-party systems or unexpired backups.

Backups contain sensitive material and need encryption, restricted access, a retention schedule, and restore verification. Protect runtime keys separately. Before restoring workers, reconcile scheduled occurrences and unfinished requests to prevent unintended duplicate processing. The exact retention defaults, authentication option, credential-storage method, and initial provider are decisions to settle before the relevant implementation milestone.

## Verification required before release

Threat-focused tests must cover unauthorized record IDs, direct Server Action invocation, forged owner IDs, cross-origin mutations, expired sessions, OAuth state mismatch, malicious redirects, private-network URL targets, oversized uploads, raw HTML, prompt injection, leaked client props, and duplicate worker deliveries. Inspect built client bundles and production logs for secrets using synthetic credentials. A self-hosted release also requires a documented disconnect/delete/export flow and a backup/restore exercise. See [Data Model](data-model.md) for persistence and provenance invariants.
