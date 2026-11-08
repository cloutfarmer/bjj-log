# BJJ Log agent guide

This is the canonical entry point for coding agents. Keep it short. Durable design
goes in `ARCHITECTURE.md`; volatile state and procedures go under `docs/`. Link to
facts instead of repeating them, and read only the documents the task needs.

BJJ Log is a private, single-user training journal: Next.js and TypeScript on
Vercel, with Neon Postgres for storage.

## Repository

- This repository is public. Never add personal paths, infrastructure IDs, the
  production URL, or journal content.
- Branches: start work on `feature/*`, `fix/*`, or `claude/*` from `dev`, review
  by PR into `dev`, and release from `dev` to `prod`.
- Land in `dev` and release to `prod` only by fast-forward, as described in
  [`CONTRIBUTING.md`](CONTRIBUTING.md#landing-and-releasing). Never use GitHub merge
  buttons. Only `prod` deploys. Keep both `"*": false` and `"**": false` in
  `vercel.json`, because `*` alone doesn't match branch names with a slash.
- Environments:
  - **LOCAL:** a development machine, using Neon branch `dev` through `.env.local`.
  - **PRODUCTION:** Vercel, using Neon branch `production`.
  - Both branches are in the same Neon project. `dev` started as a copy of
    `production` and shares no later writes with it.
- Preserve unrelated and uncommitted work. Do not commit, push, deploy, or change
  external services unless the user explicitly asks. Local checks passing never
  authorizes any of those.

## Start here

| Task | Required reading |
|---|---|
| Find where a feature lives | `README.md` |
| System design or module boundaries | `ARCHITECTURE.md` |
| Tests or verification | `docs/TESTING.md` |
| Branches, setup, pull requests, or landing and releasing | `CONTRIBUTING.md` |
| Database or Neon | `docs/NEON.md` |

`docs/README.md` is the complete index. When a doc disagrees with the code, trust the
code, then fix the doc. Release, production migration, and production secret runbooks
are kept outside this repository: ask the user before any production work.

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
   Git, test fixtures, logs, or issues. Failed tests can write page snapshots with
   journal text to `test-results/`, so never paste or print those files.
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
- `.claude/skills/ponytail-review/` is vendored unchanged (see its `SOURCE`). Don't
  edit it. `.claude/skills/pr-triage/` wraps it: it runs on each PR, fixes tier 1 and
  trivial tier 2 findings on the PR branch, and files the rest, as described in
  [`CONTRIBUTING.md`](CONTRIBUTING.md#automatic-review). Both also run on request.
