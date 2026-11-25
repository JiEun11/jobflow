# Phase 2A cloud runbook

Status: local implementation. Public deployment, cloud migration, and live collection require separate approval. The services are Vercel Hobby for Next.js, Neon Free PostgreSQL 18, and GitHub's standard public Actions runner. The Phase 2A collector runs as a finite CLI invocation and records its lease and results in PostgreSQL. No worker stays online. AI and cloud PDF storage are disabled.

## Approval and setup order

1. Review the pilot board tokens and company labels with the owner. Start with one or two. The collector accepts at most five. Confirm each service is on its free tier and avoid attaching billable resources, paid runners, external storage, or add-ons. Stop at a quota warning rather than upgrading.
2. After approval, create a dedicated Neon Free project with PostgreSQL 18 and scale-to-zero. Use the direct endpoint for administration. Set `JOBFLOW_ADMIN_DATABASE_URL` only in a private interactive shell. Keep it out of Vercel, GitHub Actions, shell history, and this checkout. Set `sslmode=verify-full` on each Neon URL. Admin endpoints omit `-pooler`.
3. After migration approval, back up existing data first. Run `JOBFLOW_APPROVE_CLOUD_MIGRATION=1 pnpm db:migrate:cloud` interactively against the intended direct PostgreSQL 18 endpoint. This applies Drizzle's ordered migrations. The application and Actions collector have no migration step.
4. Use the Neon administrative SQL session to create `jobflow_web` and `jobflow_collector` with `CREATE ROLE ... LOGIN`. Set their passwords with psql `\password jobflow_web` and `\password jobflow_collector`. Roles created through plain SQL should have no inherited administrative memberships. Apply [the explicit grants](../../ops/neon/grants.sql) as the schema owner. Verify the web role cannot write collection data and the collector cannot read private profiles, sessions, or PDFs. Run `pnpm owner:init:cloud` once in the private terminal. Account creation remains CLI-only; a PostgreSQL lock and the singleton constraint protect against concurrent initialization. Close the admin session and remove the admin environment variable afterwards.
5. After public deployment approval, configure the Vercel Hobby project for Next.js, Root Directory `apps/web`, include workspace sources outside the root in the build step, and select Node.js **26.x**. The [project config](../../apps/web/vercel.json) uses pnpm and the committed lockfile. CI and local development use the exact version in `.node-version`; Vercel chooses patches within the major version. Keep system environment variables exposed. Set the following **only under Production**:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon **pooled** TLS URL for `jobflow_web`, with `sslmode=verify-full` |
   | `JOBFLOW_APP_URL` | Exact public HTTPS origin, without a path |
   | `BETTER_AUTH_SECRET` | New strong random secret, at least 32 characters, stored as sensitive |

   Give Preview no Production variables or secrets. The Preview app blocks auth and DB access. Production uses Better Auth secure cookies and a database-backed login rate limiter. PDF list, upload, download and delete are unavailable on Vercel even when a local PDF path is present. Do not transfer local PDF bytes into a deployment. Verify `GET /api/health` returns a minimal `200` after migration, anonymous dashboard routes redirect to login, sign-up stays closed and authenticated jobs/JD views work. Health checks query the DB and can keep it awake, so use on-demand checks.
6. Create GitHub environment `phase2a-collector` with deployment branches limited to **main**. Protect that branch and require review of collector/workflow changes before merging. Add environment secret `DATABASE_URL` for the **pooled** `jobflow_collector` role only. Set environment variable `JOBFLOW_GREENHOUSE_BOARDS` to a JSON object such as `{"synthetic":"Synthetic Company"}`, substituting only approved tokens and display names. This example does not authorize live collection. Keep repository variables `JOBFLOW_COLLECTOR_ENABLED` and `JOBFLOW_COLLECTOR_SCHEDULE_ENABLED` unset until their approval gates.
7. After pilot approval and after the workflow exists on the default branch, set only `JOBFLOW_COLLECTOR_ENABLED=true`. Dispatch [the collector](../../.github/workflows/collector.yml) from `main`. Confirm the Actions result, the database attempt and per-board result, the dashboard, and quota usage. Only then, and after schedule approval, set `JOBFLOW_COLLECTOR_SCHEDULE_ENABLED=true`. Wait for an observed scheduled run and verify the dashboard and usage before declaring cloud activation complete.

[Monorepo settings](https://vercel.com/docs/monorepos/monorepo-faq) · [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) · [Neon pooling](https://neon.com/docs/connect/connection-pooling) · [GitHub environment protection](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)

## Collection operations

The schedule is `0 0 * * *` (09:00 Asia/Seoul). GitHub may delay or drop runs at the top of the hour, and may disable schedules after 60 days of inactivity for public repositories. Check the Actions history and the dashboard after the first expected occurrence. To replay a missed day, dispatch with `seoul_date=YYYY-MM-DD`. That key records the intended occurrence while the collector reads today's provider inventory. Completed days are idempotent. Partial or failed days can be retried and keep earlier board results. An interrupted runner leaves a ten-minute lease. After expiration, a new execution marks the earlier attempt failed. Provision no automatic catch-up service.

Inspect the database state in `jobflow_collection.run`, `attempt`, and `board_result` using the owner-admin session. A partial run exits nonzero but successful board data remains visible. Provider HTTP retries are bounded, `Retry-After` is respected within the retry budget, and payloads and JD text stay out of public Actions logs. The dashboard lists up to 30 eligible jobs first seen in the past 14 days. Phase 2A does not infer that a posting has closed when it disappears from a board.

[GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) · [Greenhouse Job Board API](https://docs.greenhouse.io/job-board)

## Backup and recovery

Use PostgreSQL 18 client tools with the direct Neon endpoint. Configure an OS-protected `PGSERVICE` and `PGPASSFILE` for the admin connection, with `sslmode=verify-full` and no passwords in the service file. Set restrictive file permissions, dump outside the checkout, and keep the dump encrypted on a trusted local volume. It can contain career and authentication data.

```sh
umask 077
PGSERVICE=jobflow-admin pg_dump -Fc --no-owner --no-acl -f /private/backup/jobflow.dump
pg_restore --list /private/backup/jobflow.dump
PGSERVICE=jobflow-recovery pg_restore --exit-on-error --single-transaction --no-owner --no-acl -d jobflow_recovery /private/backup/jobflow.dump
```

`jobflow-recovery` must point to a reviewed, empty recovery database separate from production; omit `--clean`. Recreate limited roles and grants, check migration history, owner access, and sample profile and job revisions, then verify the app against recovery before any cutover. Rotate the session secret and revoke restored sessions when recovering from exposure. Keep the scheduler disabled during cutover. Keep local Phase 1 PDFs with their separately backed-up local DB. Never upload backups to GitHub Actions artifacts. [Neon recovery options](https://neon.com/blog/database-recovery-strategies-to-help-you-sleep-at-night)

## Monthly planning estimate

Assumptions for one owner and up to five small boards: 100 dynamic requests/day, 0.15 seconds active CPU/request, roughly 100 KB delivered/request, 30 scheduled collect runs plus occasional manual replays. Treat these as estimates until the pilot reports measured usage.

| Service | Estimated monthly usage | Published free allowance |
| --- | --- | --- |
| Vercel Hobby | ~3,000 invocations, ~0.13 CPU-hours, ~0.30 GB transfer | 1M invocations, 4 active CPU-hours, 100 GB fast data transfer |
| Neon Free | ~7.5–15 CU-hours assuming 1 active hour/day at 0.25–0.5 CU; under 0.10 GB initially for metadata and JD snapshots; target under 0.20 GB transfer | 100 CU-hours, 1 GB Postgres storage, 5 GB transfer per project |
| GitHub Actions | ~60–120 runner minutes for 30 runs at 2–4 minutes, plus reruns; no uploaded artifacts | Standard runners free in public repositories |

Monitor Vercel Usage, Neon project Usage, and GitHub Actions run durations. Check after the manual pilot and the first scheduled run, then weekly. Review usage at 70% of any quota and pause collection before reaching it. Leave both provider accounts on their free tiers and keep AI and cloud PDF storage off. [Vercel limits](https://vercel.com/docs/limits) · [Neon pricing](https://neon.com/pricing) · [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage)
