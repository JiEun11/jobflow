# ADR 0001: Use TypeScript and Next.js with explicit feature boundaries

- **Status:** Proposed
- **Date:** 2026-11-05

## Context

Jobflow needs an interactive document/review workspace, server-side access to private records, and background processing. The owner requested a modern TypeScript frontend and a Next.js-oriented backend design. The open-source project should not depend on an AI editor or proprietary agent runtime.

## Decision

Use Next.js App Router for the web application and BFF, React for UI composition, and TypeScript across the web, worker, and shared packages. Organize the web application by product feature with thin route files. Use Server Components for initial reads, small Client Components for interaction, and authorized Server Actions for short mutations.

Keep the domain/application core framework-independent. Next.js entry points adapt transport to use cases; they do not own business policy. Use explicit DTO contracts and runtime validation at untrusted boundaries. Feature-first organization is a Jobflow convention; it is not claimed to be a mandatory Next.js architecture or a universal industry standard.

## Alternatives

| Alternative | Assessment |
| --- | --- |
| Python/FastAPI plus separate React application | Useful document-processing ecosystem, but two application languages and a separate API contract add complexity before a concrete Python-only requirement exists |
| Next.js routes containing all business logic | Fast initially, but duplicates policy when the worker is added and makes domain testing depend on framework behavior |
| Full layered frontend methodology with many required taxonomy folders | Can help a large team, but would create abstractions before this product needs them |
| Generic plugin/agent framework as the product core | Makes ordinary storage, ownership, and workflow behavior harder to reason about and limits installation portability |

## Consequences

Shared TypeScript contracts reduce accidental drift, but static types do not validate remote input or authorize a request. Server/client import boundaries must be enforced, and runtime schemas are still required. Document parsing or rendering may later justify an isolated external process; that should follow a demonstrated need, not restore a second backend by default.

The decision is accepted only after owner review. Exact stable versions and patches are pinned during the approved scaffold, with the source references checked again.

## References

- [Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure)
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js data security](https://nextjs.org/docs/app/guides/data-security)
