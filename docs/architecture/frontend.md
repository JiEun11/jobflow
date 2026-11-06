# Frontend Architecture

Status: **Proposed — approval required**  
Reviewed: **2026-11-05**  
Scope: the planned `apps/web` application. This document describes intended behavior; no application or configuration is implemented yet.

## 1. Architectural decision

Use the Next.js App Router with compatible stable React and strict TypeScript. Organize product code by feature, keep route files small, and render on the server by default. Client Components own interactions that require browser state or APIs. This is a project convention built on Next.js capabilities, not an official mandatory folder architecture. Exact dependency versions will be selected and locked during implementation.

The web app and the independent worker share application services and contracts. The frontend does not contain a second copy of matching, visa classification, document generation, or application-stage rules.

Primary references: [Next.js project organization](https://nextjs.org/docs/app/getting-started/project-structure) and [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components).

## 2. Structure and ownership

```text
apps/web/src/
  app/
    (public)/sign-in/page.tsx
    (workspace)/
      layout.tsx
      onboarding/page.tsx
      page.tsx                    Today: /
      profile/page.tsx
      jobs/page.tsx
      jobs/[jobId]/page.tsx
      applications/page.tsx
      applications/[applicationId]/page.tsx
      documents/[documentId]/page.tsx
      inbox/page.tsx
      automation/page.tsx
      settings/page.tsx
      settings/integrations/page.tsx
    api/                          OAuth, downloads, run polling
    error.tsx
    not-found.tsx
  features/
    profile/
    discovery/
    applications/
    documents/
    inbox/
    automation/
    settings/
  components/
    ui/                           Product-neutral primitives
    shell/                        Navigation and shared layout
  lib/
    client/                       Browser-only helpers
    server/                       Identity and composition root
```

The route tree is proposed, not a list of working URLs. The root page is labeled **Today** in navigation. Route-local `loading.tsx`, `error.tsx`, and `_components/` are added where a distinct loading boundary or a single-route composition is useful. A feature is created when behavior exists; empty directory scaffolding is unnecessary.

An example feature boundary:

```text
features/discovery/
  components/job-filters.client.tsx
  components/job-list.tsx
  components/visa-evidence.tsx
  server/queries.ts
  server/actions.ts
  server/view-model.ts
  validation.ts
```

`page.tsx` composes the screen. `queries.ts` obtains an authorized, presentation-ready DTO through the shared application layer. `actions.ts` validates commands and invokes the same layer. A `*.client.tsx` suffix documents a browser boundary; the `"use client"` directive establishes it.

## 3. Import rules

| Importer | Allowed dependencies | Boundary |
| --- | --- | --- |
| Route composition | Feature entry points, shell, server composition | No business rules or SQL in route files |
| Feature server modules | Contracts, core services, server composition | Mark with `server-only`; never import browser modules |
| Feature client modules | Browser-safe contracts, UI primitives, browser helpers | No database, provider clients, tokens, or server composition |
| UI primitives | React and presentation utilities | No feature data loading or provider knowledge |
| Worker | Core, database, integrations, contracts | Must not import `apps/web` or Next.js APIs |

Feature-to-feature imports are restricted to deliberately exported contracts or presentation components. Cross-feature workflows belong in shared application services; cross-feature screen composition belongs in routes. Use explicit imports and type-only imports where appropriate. Avoid broad barrel files that mix client and server exports. Importing a designated Server Action reference is permitted through Next.js's action transport; importing arbitrary server helpers into a Client Component is not.

## 4. Reads, writes, and background work

**Reads:** a Server Component resolves the current principal and calls an authorized query/service directly. It does not send HTTP requests to its own Route Handlers. Queries return minimal DTOs rather than database rows.

**Writes:** short UI commands use Server Actions. Every action authenticates, authorizes the target owner, validates input, and returns a serializable result with field errors or a stable error code. Use `useActionState` for pending and result handling; request submission also works through semantic forms. A client-side validation pass improves feedback but never replaces server validation.

**Long work:** an action records/enqueues work and returns its run identifier. A small client island polls the authorized run endpoint while the run is active, backs off after failures, and stops when terminal or unmounted. Generation never remains inside a request for its entire duration. A finished run refreshes the affected server-rendered view. WebSockets, SSE, and a general client query cache are not initial requirements.

**Route Handlers:** use them for `POST /api/imports`, OAuth connection callbacks under `/api/integrations/[provider]/...`, `GET /api/documents/[documentId]/download`, `GET /api/runs/[runId]`, and a minimal `GET /api/health`. They invoke the same services as actions, with equivalent authorization. They are not automatically private because they live under `app/api`.

References: [Next.js backend-for-frontend guidance](https://nextjs.org/docs/app/guides/backend-for-frontend), [mutating data](https://nextjs.org/docs/app/getting-started/mutating-data), and [React useActionState](https://react.dev/reference/react/useActionState).

## 5. State, types, and caching

| State | Owner |
| --- | --- |
| Filters, sort, pagination, selected tab | Validated URL search parameters |
| Saved profile, applications, document versions | Server database |
| Open dialog, temporary selection, unsaved input | Nearest Client Component |
| Command errors and submission pending state | Form/action state |
| Background run progress | Persisted run record, temporarily polled |

There is no global state store initially. Optimistic updates are limited to reversible interactions such as shortlist toggles, with rollback on failure. Generation, document approval, and application-stage changes await a persisted result. Unsaved editing is visibly marked and protected before navigation.

The TypeScript baseline is `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes`. Untrusted input begins as `unknown` and is checked by runtime schemas. DTOs and command schemas belong in `packages/contracts`; ORM types, credentials, and raw mail content do not become component props. Use discriminated unions for run state, visa assessment, and command results rather than booleans that allow contradictory combinations.

Private user data is request-scoped and uncached by default. Do not add shared `use cache`, static generation, or cross-user cache entries around profile, mail, or document queries. Any later cache proposal must define owner keys, invalidation, and leakage tests. Successful actions invalidate affected views; polling handles changes made independently by the worker. Public static assets may use normal caching.

References: [data security](https://nextjs.org/docs/app/guides/data-security), TypeScript [strict](https://www.typescriptlang.org/tsconfig/strict.html), [indexed access](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html), and [optional properties](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html).

## 6. Presentation and verification

Tailwind CSS with locally owned shadcn/ui primitives is the proposed UI foundation. Product components sit above primitives and use semantic color, spacing, typography, focus, and status tokens. Visual conventions are specified in the [experience design](../product/experience.md). [shadcn/ui documentation](https://ui.shadcn.com/docs) describes the component ownership model; it does not prescribe Jobflow's screen design.

Each route defines loading, first-use empty, filtered-empty, recoverable error, missing record, and access-denied behavior. Disconnected providers and partial run failures remain explicit. Display safe error messages with a correlation identifier, and retain raw exceptions only in redacted server logs.

Acceptance checks cover import boundaries, contract validation, command error rendering, URL filter round-trips, keyboard navigation, focus restoration, and the complete review workflow. An authorization test must prove that a caller cannot read another owner's record by changing a route ID. A browser-bundle inspection must confirm that database and provider modules are excluded. UI fixtures use synthetic data only and are clearly identified as demo content.
