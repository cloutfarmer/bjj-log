# BJJ Log agent guide

This is the canonical entry point for coding agents. Keep it short. Link to facts
instead of repeating them, and read only the documents the task needs.

BJJ Log is a private, single-user training journal: Next.js and TypeScript on
Vercel, with Neon Postgres for storage.

## Repository

- Canonical checkout: `this repository`.
- `another project` is a separate project. Never copy its facts,
  environment names, or invariants into this repo.
- Branches: start work on `feature/*` or `fix/*` from `dev`, merge to `dev` by PR,
  and release from `dev` to `prod`. `main` is kept for history. Don't base work on it.
- Environments:
  - **LOCAL:** this Mac, using Neon branch `dev` through `.env.local`.
  - **PRODUCTION:** Vercel at https://your-deployment.example, using Neon branch
    `production`.
  - Both branches are in the same Neon project. `dev` started as a copy of
    `production` and shares no later writes with it.
- Preserve unrelated and uncommitted work. Do not commit, push, deploy, or change
  external services unless the user explicitly asks. Local checks passing never
  authorizes any of those.

## Start here

| Task | Required reading |
|---|---|
| Find where a feature lives | `README.md` |
| Branches, reviews, or releases | `docs/WORKFLOW.md` |
| Deploys or Vercel | `docs/HOSTING.md` |
| Database, migrations, or Neon | `docs/NEON.md` |
| TypeScript patterns used here | `docs/TYPESCRIPT.md` |
| Agent setup progress | `docs/plans/agentic-setup.md` |

`docs/README.md` is the documentation index. When a doc disagrees with the code,
trust the code, then fix the doc. The safety rules below override older
instructions in `docs/HOSTING.md` and `docs/NEON.md`.

## Safety rules

1. Say **LOCAL** or **PRODUCTION** before running or recommending any command that
   touches the database or a deployment.
2. Never print, commit, or paste secrets. All `.env*` files except `.env.example`
   hold real credentials, so show variable names only and mask connection strings.
3. Before any command that uses the database, including `npm run db:migrate`, run
   `grep '^NEON_BRANCH=' .env.local` and confirm it says `dev`. Otherwise stop.
4. `neon checkout`, `neon deploy`, and `neon env pull` can rewrite `.env.local`.
   Never run `neon checkout production` in this checkout: local saves, tests, and
   migrations would then reach the real journal.
5. Never run `tests/storage.spec.ts` or `npm run test:e2e` with `TEST_BASE_URL` set
   to the live site. The storage test writes and deletes rows in whichever database
   the server uses. Verify production by hand instead.
6. Merging or pushing to `prod` should be treated as a production deploy, because
   `vercel.json` enables Git deployments for that branch. `npm run deploy:prod` also
   deploys. Both need explicit approval.
7. `scripts/vercel-env.mjs` overwrites production secrets. Never run it without
   explicit approval.
8. Never edit a migration in `db/migrations/` after it has been applied:
   `scripts/migrate.mjs` rejects a changed checksum. Add a new file instead.
   Builds must never apply migrations.
9. Neon branch `dev` contains a copy of the real journal. Never put its contents in
   Git, test fixtures, logs, or issues.
10. Commands must use known paths and values. If a value is unknown, run a discovery
    command first. Never leave a placeholder that could be pasted literally.

## Engineering invariants

- Every data endpoint checks the session itself, and every write also checks that
  the request is same-origin.
- Database and auth code stays server-only. Never give a credential a
  `NEXT_PUBLIC_` prefix.
- Input from HTTP or browser storage is checked by `lib/entries.ts` before use.
- Import never overwrites an entry already in the cloud, and leaves the browser's
  copy untouched.
- An entry with no text, no session types, and no attire is deleted. The client in
  `app/components/Journal.tsx` and the API routes must apply the same rule.
- A failed save keeps the draft open in the editor.
- Dates are stored as `YYYY-MM-DD`, one entry per day.
- Journal text and credentials never appear in logs, error messages, or test traces.

## Working standard

- Prefer the fast search tool. Treat code, migrations, and tests as evidence.
- Label facts as validated, unvalidated, inferred, or historical.
- Update the canonical doc in the same change as the behavior.
- Use CSS Modules and the variables in `app/globals.css`. Add no UI library or
  external font.
- Run the smallest safe check first: `npm run typecheck`, `npm run lint`,
  `npm run build`, `git diff --check`.
