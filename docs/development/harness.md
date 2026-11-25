# Development harness

## Repository and session boundaries

Start at the repository root with [AGENTS.md](../../AGENTS.md), the task, and `git status --short --branch`. Then read the nearest implementation and tests. Load the linked product, architecture, or runbook section only when the task crosses that boundary. Use `rg`, focused diffs and bounded command output. Keep long logs local and report the relevant error and reproduction command.

Codex CLI loads at most one non-empty instruction file per directory, preferring `AGENTS.override.md` over `AGENTS.md` and configured fallback names. It starts with the Codex home and walks the project root to the launch working directory. Deeper guidance takes precedence. Jobflow uses one root file. Start a new session after changing automatic instructions when verifying what actually loads. [Codex manual](https://developers.openai.com/codex/codex-manual.md)

Skills load their catalog metadata first, then the selected `SKILL.md` and referenced material as needed. In Codex CLI, repo skills can live under `.agents/skills` and be invoked by name or matched by description. Orca may also expose host and plugin skills in the active session. Jobflow ships zero custom skills and zero custom agents. The current repeatable work is a shell command. Add a skill when a recurring judgment-based workflow has demonstrated inputs, outputs, and repeated use. [Codex manual](https://developers.openai.com/codex/codex-manual.md#execution-model-and-workflows)

## Agents and external tools

The primary agent owns the patch and verification. When authorized and available, delegate independent work such as a read-only review or an investigation of a separate failure. Give each worker a narrow scope and a concrete result. For parallel edits use isolated worktrees or disjoint file ownership. The primary agent reconciles changes and reruns the gate. Parallel work can reduce elapsed time and increases total model and tool work. [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)

Use the shell for repository and test work. Check the current session discovery surface before relying on a connector. A tool in the catalog establishes discoverability. Account access and authorization must be checked for the intended operation. For local CLI, `codex mcp list --json` reports configured servers. Orca's active chat provisions tools independently. Preserve the managed sandbox and approvals. Escalate only the specific blocked operation when warranted. Repository instructions cannot grant access to protected paths, credentials, or third-party accounts. [Codex sandbox and approvals](https://learn.chatgpt.com/docs/agent-approvals-security)

## Context and handoff

Keep one session for a coherent task. In interactive Codex CLI, `/status` shows context and usage, `/compact` summarizes long threads, and `codex resume` resumes a saved CLI session. Orca has separate session identities and runtime commands. Use the active surface's help before assuming these commands are interchangeable. [Codex CLI commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli)

For a transition, send a short private handoff with:

1. Objective, acceptance outcome and latest owner decision.
2. Branch and base commit, worktree path, and whether the patch is committed. Include exact paths if the recipient must reuse the same dirty worktree.
3. Relevant files and the reason for the change.
4. Verification commands with pass, fail or skipped status.
5. Unresolved blocker or first next action.

The receiver rechecks Git and current files. Link durable decisions from the appropriate product or architecture page. Keep handoff notes in the private thread unless a lasting repository decision belongs in the docs. In CLI, compare usage via `/status` for like-for-like sessions if needed. File length is a context-size proxy, not a token measurement.

## Phase 1 workflow

1. Check the branch, inspect the target boundary and identify one observable outcome.
2. Make the smallest complete change and exercise the reachable route with synthetic data.
3. Run `pnpm verify` from the root using the [runbook](../planning/phase1-local.md) prerequisites. It runs lint, strict type checking, a production build and the existing PostgreSQL/Playwright integration suite.
4. Review the diff and hand off the result. [.github/workflows/phase1.yml](../../.github/workflows/phase1.yml) runs the same command for pull requests with read-only repository permissions and an isolated test database. Branch protection and required status checks are repository settings.

For the rationale and old-to-new map, read the [design audit](harness-audit.md).
