# Contributing

This is a personal project, so this guide mainly records how it is developed.

## Setup

Requires Node.js 22 and a Postgres database, such as a free [Neon](https://neon.tech)
project. The browser tests also need Google Chrome.

```bash
npm ci
cp .env.example .env.local
```

Set these in `.env.local`, which Git ignores:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Postgres connection string the app uses. On Neon, the pooled one |
| `DATABASE_URL_UNPOOLED` | Direct connection string, used only for migrations |
| `NEON_BRANCH` | Leave as `dev`. The safety checks in the docs read it |
| `BJJ_PASSWORD` | The password you'll sign in with |
| `BJJ_SESSION_SECRET` | A separate random value of at least 32 characters. `openssl rand -base64 48` makes one |

Use a development database, never one holding data you care about, because the storage
test writes to it. Then create the schema and start the app:

```bash
npm run db:migrate
npm run dev
```

Open http://localhost:3000. The development server builds into `.next-dev`, so it can
run alongside a production build in `.next`.

## Branches

`dev` holds integrated work and `prod` holds released code. Merging to `prod` deploys it
to production.

```bash
git switch dev
git pull --ff-only
git switch -c feature/your-change
```

Use `feature/*` or `fix/*`. For an urgent production fix, branch from `prod`, release
the fix, then merge it back into `dev`.

## Verification

Run these before opening a PR:

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
```

Run browser tests when you change the UI, API, or database code. See the
[testing guide](docs/TESTING.md) first, because some tests write to the database.

## Commits and pull requests

- Write commit subjects as behavior, in the imperative: "Reject unusable exports before
  processing them". Keep one concern per commit.
- Stage only the files you intend to commit, and inspect `git diff --staged` first.
- Target `dev`. Describe the problem, the resulting behavior, and the checks you
  actually ran.

## Database changes

Add a new file in `db/migrations/`; never edit one that has been applied. Test it
locally with `npm run db:migrate`. Reverting code doesn't undo a migration, so plan data
recovery before any destructive schema change.

## Dependency updates

Review `npm audit` findings before committing, and don't use `npm audit fix --force`
blindly: it can propose incompatible downgrades or major-version changes. The overrides
in `package.json` keep PostCSS, Zod under `@vercel/cli-config`, and brace-expansion 1.x
on patched releases of the same major version. Revisit them when upstream packages
update their requirements.
