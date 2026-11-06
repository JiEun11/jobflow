# Architecture source register

**Review date:** 2026-11-05 · **Status:** documentation research, not dependency verification

The proposal uses primary framework, language, library, and provider documentation. These references support specific capabilities and constraints; they do not establish that one folder structure is universally the newest or most popular architecture. Jobflow's feature organization, package count, database choice, and delivery order are project decisions.

## Framework and language

| Source | Use in this design |
| --- | --- |
| [Next.js project structure](https://nextjs.org/docs/app/getting-started/project-structure) | App Router file conventions, route groups, private folders, and optional `src` organization |
| [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) | Server-rendered pages with deliberately small interactive browser boundaries |
| [Next.js mutating data](https://nextjs.org/docs/app/getting-started/mutating-data) | Server Function/Action mutation entry points |
| [Next.js data security](https://nextjs.org/docs/app/guides/data-security) | Server-only authorized data access and minimal DTOs |
| [Next.js backend for frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) | Route Handler responsibilities, direct server reads, and deployment lifetime limits |
| [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting) | Deployment behavior requiring an explicit self-hosting design |
| [Next.js `use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) | Reviewed capability; intentionally not enabled for private owner data in the baseline |
| [React `useActionState`](https://react.dev/reference/react/useActionState) | Form/action pending and result state |
| [TypeScript `strict`](https://www.typescriptlang.org/tsconfig/strict.html), [indexed access](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html), [optional properties](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html) | Proposed compile-time checks, in addition to runtime validation |
| [Node.js release schedule](https://nodejs.org/en/about/previous-releases) | LTS runtime selection; Node 24 is a proposed conservative baseline, not a claim that it is the newest major |

The consulted Next.js documentation identified the 16.x App Router family. No framework or package version has been installed or locked. Recheck security patches, compatibility, and support status when implementation begins.

## Proposed supporting libraries

| Source | Design use |
| --- | --- |
| [pnpm workspaces](https://pnpm.io/workspaces) | One repository containing web, worker, and shared packages |
| [Zod](https://zod.dev/) | Boundary schemas and inferred transport types |
| [Drizzle](https://orm.drizzle.team/docs/overview) | Typed PostgreSQL schema, queries, and reviewed application migrations |
| [pg-boss](https://github.com/timgit/pg-boss) | PostgreSQL-backed Node queue adapter; product-level idempotency remains Jobflow's responsibility |
| [shadcn/ui](https://ui.shadcn.com/docs) | Locally owned presentation primitives |
| [Better Auth](https://better-auth.com/docs/introduction) | Preferred authentication/session adapter proposal, not an implemented sign-in flow |
| [Vitest](https://vitest.dev/guide/) | Planned domain and integration checks |
| [Playwright](https://playwright.dev/docs/intro) | Planned browser checks against the running application |

Exact stable package versions, transitive dependencies, licenses, advisories, and queue/database compatibility are intentionally deferred to the approved scaffold. Do not infer a completed supply-chain or provider review from this list.

## Job sources and integration constraints

- [LinkedIn job alerts](https://www.linkedin.com/help/linkedin/answer/a511279): the supported alert path considered for discovery input.
- [LinkedIn prohibited automation guidance](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibited-software-and-extensions): why automated login and page scraping are excluded from the proposed collector.
- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board): proposed first public ATS adapter.
- [Lever Postings API](https://github.com/lever/postings-api): possible later board adapter.
- [Ashby public job posting API](https://developers.ashbyhq.com/docs/public-job-posting-api): possible later board adapter.

These board APIs are company-scoped inputs. The source list does not imply a licensed global job-search index, access to a user's LinkedIn account, an installed mail integration, or an active schedule.

Country-specific visa evidence sources, the first mailbox provider's exact consent requirements, and the first AI provider's processing terms require separate review after the corresponding user choices. They are not generalized from one country or provider to every deployment.
