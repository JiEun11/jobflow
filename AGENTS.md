# Jobflow agent instructions

- Start with `git status --short --branch` and inspect the files relevant to the task. Preserve existing work and identify which changes belong to this task.
- Keep route handlers thin. Validate input and authorize the owner on the server. Keep credentials, uploaded files, personal data, and raw connector responses out of Git, chat handoffs, and logs. Use synthetic fixtures.
- Read the [architecture](docs/architecture/overview.md) only for boundary, storage, or migration changes. Read the [requirements](docs/product/requirements.md) for product scope. Use the [local runbook](docs/planning/phase1-local.md) for setup and tests.
- Use targeted checks while iterating. Run `pnpm verify` for application changes before handoff and report any unverified check. Preserve applied migrations and use forward migrations for schema changes.
- Work in one agent by default. For session transitions use the [handoff checklist](docs/development/harness.md). Get explicit approval before commits, pushes, merges, external integrations, or deployment.
