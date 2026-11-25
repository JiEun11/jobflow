# Phase 1 local setup

The local web app supports a single owner, a versioned career profile, and private PDF uploads. The dashboard shows the current profile, search preferences, and resumes. The configured daily collection time is displayed as inactive. The independent worker, durable queue validation, and scheduled collection are Phase 2 work.

## Requirements

- Node.js 26.13.1 and pnpm 12.21.0. The repository declares both versions.
- Local PostgreSQL. The integration suite uses PostgreSQL 18.
- A private directory outside the Git checkout for PDF files. The app can create the last directory component under an existing parent. A directory you create yourself must be owned by the app user with mode `0700`.

If Node.js and pnpm were provisioned under the Jobflow-specific toolchain directory, enable them for the current shell:

```sh
export PATH="$HOME/.local/share/jobflow/toolchain/node/bin:$HOME/.local/share/jobflow/toolchain/pnpm/node_modules/.bin:$PATH"
```

On macOS with the PostgreSQL 18 Homebrew formula installed, prepend `/opt/homebrew/opt/postgresql@18/bin` to the current shell's PATH. A compatible existing local PostgreSQL server can also be used. Use a dedicated database and connection role. Example for a separate native instance:

```sh
umask 077
mkdir -p "$HOME/.local/share/jobflow"
initdb -D "$HOME/.local/share/jobflow/pg" -U jobflow --auth=scram-sha-256 --pwprompt
pg_ctl -D "$HOME/.local/share/jobflow/pg" -l "$HOME/.local/share/jobflow/postgres.log" \
  -o "-h 127.0.0.1 -p 55432 -k '$HOME/.local/share/jobflow'" -w start
createdb -h 127.0.0.1 -p 55432 -U jobflow -W jobflow
```

At the repository root, run `pnpm install --frozen-lockfile`. Copy `.env.example` to a new `.env` with mode `0600` and set:

- `DATABASE_URL` to the dedicated local PostgreSQL URL, adjusting the port to match and URL-encoding the password.
- `BETTER_AUTH_SECRET` to a cryptographically random value of at least 32 characters. For example, generate a value with `openssl rand -hex 48` in a private shell.
- `JOBFLOW_APP_URL` to `http://127.0.0.1:3000` for the default start command.
- `JOBFLOW_DATA_DIR` to an absolute private path such as `/Users/your-user/.local/share/jobflow/resumes`.

```sh
pnpm db:migrate
pnpm owner:init
pnpm dev
```

The owner initialization command reads the email and a password of 14–128 characters from the terminal. Password input is hidden. The server exposes email sign-in, session lookup, and sign-out. Open `http://127.0.0.1:3000` and sign in with the owner account. For a production-mode local run, use `pnpm build` followed by `pnpm start`.

## Profile history and file lifecycle

A profile version is identified by the owner and revision. The database stores personal information, experiences, skills, projects, education, and preferences in separate structured columns. Stable entry IDs link experience and project snapshots to skills, and outcomes can record supporting context. Viewing a version is read-only. Restoring it appends a new version and records the source revision. Archiving removes the current profile from the dashboard while retaining its revisions. Archiving is reversible.

A resume upload accepts validated, readable PDFs up to 5 MiB. The database records the storage identifier, safe display filename, byte size, SHA-256 digest, and timestamps. Downloads require the current owner session. Deletion records a pending marker before removing the bytes, then deletes the DB record. While deletion is pending the file is unavailable for download. The dashboard allows the owner to retry an interrupted deletion.

Back up the PostgreSQL database and private PDF directory together while writes are stopped. A process crash between writing a new file and committing its DB transaction can leave an unreferenced private file. Automatic orphan cleanup and backup/restore tooling are follow-up work. Keep the session secret in protected configuration. Owner password recovery and deployment beyond the local loopback address need a separately reviewed procedure.

## Verification

```sh
PLAYWRIGHT_BROWSERS_PATH=0 pnpm exec playwright install chromium --only-shell
NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_BROWSERS_PATH=0 JOBFLOW_TEST_PG_BIN=/opt/homebrew/opt/postgresql@18/bin pnpm verify
```

The verification command runs lint, strict type checking, a production build and the integration suite in that order. A failing stage stops the remaining stages. Tests create a disposable PostgreSQL cluster on a private Unix socket and start the production server on an available loopback port. Test data is synthetic. Set `JOBFLOW_TEST_PG_BIN` to the PostgreSQL 18 binary directory or omit it when the binaries are on PATH. GitHub Actions uses the stock PostgreSQL 18 binaries on Ubuntu 26.04 and starts its own isolated cluster.
