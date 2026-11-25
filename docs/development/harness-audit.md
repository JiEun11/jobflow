# Harness redesign audit

The initial design is preserved at Git commit `951aa7a`. Use `git show 951aa7a:<old path>` for historical detail. The working Phase 1 implementation takes precedence for behavior. This audit is a migration record and is read on demand.

| Classification | Previous path or approach | Destination and tradeoff |
| --- | --- | --- |
| Improve | `README.md` | Short entry point with links. Historical roadmap and proposed directories leave the landing page. |
| Remove | `docs/README.md` | The root README is the single index. Maintainers update one index as documents move. |
| Keep / Improve | `docs/product/requirements.md` | Retain PR-01 through PR-14, later product behavior, and non-goals. Record approved Phase 1 and search defaults. |
| Merge | `docs/product/experience.md` | Keep product behavior in the PRD and cross-screen constraints in the roadmap. Detailed future wireframes return when their slices are designed. |
| Replace | `docs/architecture/overview.md` | Describe the running web/database/filesystem topology and actual package boundaries. Future topology belongs to the worker ADR. |
| Merge | `docs/architecture/frontend.md`, `docs/architecture/backend.md` | Use the architecture overview, worker ADR, and roadmap. Drop speculative folder trees and contracts. |
| Merge | `docs/architecture/data-model.md` | Use the checked-in schema and migrations for live fields. Keep future identity, versioning, idempotency, and state boundaries in the PRD and roadmap. Defer future table shapes until implementation. |
| Merge | `docs/architecture/workflows.md` | Move the durable execution and source checkpoint contracts to the roadmap. Preserve product intent and acceptance outcomes in the PRD. |
| Keep | `docs/architecture/privacy-security.md` and ADRs 0001–0003 | Retain privacy boundaries and the original decision rationale. Separate the accepted Phase 1 decisions from the proposed worker. |
| Remove | `docs/architecture/sources.md` | Place primary references next to the decision that uses them. Verify provider availability again when its slice starts. |
| Replace | `docs/planning/implementation-plan.md` | Use Phase 1 and Phase 2 terminology and define current exit evidence without prescribing future package scaffolds. |
| Replace | `docs/planning/quality-strategy.md` | Use `pnpm verify`, the integration suite, and PR CI for Phase 1. Keep dependent future tests alongside product criteria. CI adds runtime cost in exchange for executable evidence. |
| Improve | `docs/planning/phase1-local.md` | Keep setup and operational details. Point to the same verification command CI runs. |
| Replace | Repeated session prompts and manual check sequences | One root `AGENTS.md`, optional harness and handoff guide, and executable checks. Custom agents, skills, hooks, and repo MCP settings are deferred. |

## Environment evidence

| Capability | Verified evidence and limit |
| --- | --- |
| Guidance | Official manual reviewed for hierarchy and context. `codex debug prompt-input` confirmed the root instructions in local CLI input. The check emitted only a boolean. |
| Skills | The active session exposed installed skills. The selected Orca CLI returned its version-matched guide and reference index. No new project skill is required for the shell-based gate. |
| Parallelism | Codex documentation and the active tool surface expose subagents. Orca 1.4.271 reports a running runtime and exposes launch commands. No worker was launched. |
| Handoff | Codex CLI 0.170.0 exposes `resume`. The structured handoff works from Git and current files across surfaces. No persisted session was reopened. |
| MCP | Local CLI reported enabled browser/computer-use and Node REPL servers. The Orca chat tool catalog separately exposed connector tools. Private external account access was not exercised. |
| Sandbox | The workspace was writable and Git metadata protected. The new branch required narrowly scoped escalation. The same applied to the official manual download and Orca runtime query after sandbox denial. |
| Context usage | Measure repository document size separately from session tokens. Use the CLI status display for live usage when available. The audit makes no token savings claim. |
| Quality gate | Final validation passed locally with PostgreSQL 18.6 and a 10/10 Node test summary, including desktop and mobile Chromium. An isolated fixture confirmed lint → typecheck → build → test, exact nonzero exit codes, and fail-fast behavior. CI now targets PostgreSQL 18 on Ubuntu 26.04. The hosted run remains unverified. |
| Independent evaluation | A fresh read-only Codex CLI session distinguished Phase 1 from scheduled collection, identified the risk of anonymous PDF access, and reported the injected test failure as exit 40. It used the repository and a synthetic verification log. |

Repository guidance ships without changing personal Codex configuration, provider authorization, or managed policy. [Codex manual](https://developers.openai.com/codex/codex-manual.md)
