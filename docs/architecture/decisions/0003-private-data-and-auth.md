# ADR 0003: Keep private data outside Git and require explicit identity

- **Status:** Proposed
- **Date:** 2026-11-05

## Context

The project is intended for public source distribution while processing resumes, correspondence, access credentials, and generated application files. A single-owner installation does not make incoming HTTP requests trustworthy, and application sign-in does not grant mailbox consent.

## Decision

Keep code and synthetic examples in the repository. Store records in PostgreSQL, artifacts in a private data directory outside the checkout, and credentials through a server-only encrypted credential adapter. Supply encryption material through protected runtime configuration, separately from ordinary database backups.

Require an explicit owner bootstrap and session even for a loopback-bound local installation. Close registration after the first owner is provisioned. Prefer a reviewed Better Auth session adapter, subject to validating its Next.js integration, deployment configuration, and migration ownership in the foundation slice. Do not create a homemade authentication protocol.

Treat mailbox OAuth as a separate owner-bound connection using only the permissions required to read relevant messages. Every transport and application operation authorizes records by owner; workers validate durable owner-scoped inputs. Exposing the app beyond loopback requires the reviewed authenticated HTTPS deployment path.

## Alternatives

- Storing personal files inside ignored repository directories: convenient, but makes public exports, examples, and accidental Git additions harder to reason about; use an external runtime path instead.
- Treating all localhost requests as the owner: reduces setup but leaves an unjustified authentication bypass.
- Making a ChatGPT plugin the sole identity or mailbox connection: useful optionally, but unsuitable as the only access path for a portable self-hosted application.
- Implementing a multi-tenant identity system immediately: unnecessary scope for the first single-owner release.

## Consequences

Setup needs an owner/session bootstrap, data path, runtime secret, and documented recovery procedure. Backups must account for database state, artifact bytes, and separately protected keys. Source availability does not mean the product is ready for broad account distribution; provider consent/verification and the project license remain release decisions.

See [privacy and security](../privacy-security.md) for OAuth, external content, download, logging, and retention details.

## References

- [Next.js data security](https://nextjs.org/docs/app/guides/data-security)
- [Better Auth introduction](https://better-auth.com/docs/introduction)
