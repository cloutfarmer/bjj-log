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

Use `feature/*` or `fix/*`. Agent sessions on the web or a phone push `claude/*`
branches. Those follow the same rules. For an urgent production fix, branch from `prod`
and release the fix. Then merge `prod` into `dev` locally and push `dev`, so `prod`
stays an ancestor of `dev`.

## Landing and releasing

Preview deployments are off. In `vercel.json`, `"*": false` skips branches without a
slash, such as `dev`, and `"**": false` skips the rest, such as `feature/*` and
`claude/*`. Only `prod` deploys. Vercel reads `vercel.json` from the pushed commit, so a
branch made before this rule existed can still start a build. `scripts/check-deployment.mjs`
then fails it, and the PR shows a failed "Vercel" status that deploys nothing. To see a
PR, find its branch with `gh pr list`, check that branch out in a separate worktree,
and run `npm run dev` there.

Push only from a clone of this repository. Commit with your GitHub noreply address,
and don't use GitHub's merge, squash, or rebase buttons: each one writes a new commit
under the merging account's commit email. Instead, land work by fast-forward:

```bash
git fetch origin
git switch feature/your-change
git rebase origin/dev
git merge-base --is-ancestor origin/dev HEAD && git push origin HEAD:dev
```

The `merge-base` check stops the push if the branch doesn't contain `dev`. When the
PR's commits reach `dev`, GitHub marks the PR as merged.

Releasing fast-forwards `prod` to `dev`. **This deploys to production**, so do it only
after review and with approval:

```bash
git fetch origin
git log --oneline origin/prod..origin/dev
git push origin origin/dev:prod
```

Git rejects that push unless it is a fast-forward.

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

### Automatic review

`.github/workflows/claude-pr-review.yml` runs the
[`pr-triage`](.claude/skills/pr-triage/SKILL.md) skill once when a PR is opened,
reopened, or marked ready. pr-triage runs
[`ponytail-review`](.claude/skills/ponytail-review/SKILL.md), then sorts each finding:

- **Tier 1, critical:** always fixed.
- **Tier 2, minor:** fixed if trivial or a likely edge case, otherwise filed as an issue.
- **Tier 3, unreachable or not a bug:** filed as an issue.

Fixes land as one commit, `review: fix tier 1/2 findings from pr-triage`, on the PR
branch, after `npm run typecheck` and `npm run lint` pass. It skips PRs whose source
branch is `dev` or `prod`, so it never pushes to either, and never touches migrations, `vercel.json`, `neon.ts`, `scripts/`,
`.github/`, `.claude/`, or env files. A critical finding there is reported as "needs
human". It posts one comment with a table of findings and a verdict. Review its fix
commit like any other before landing the PR.

It doesn't run on later pushes. To run it again, add the `claude-review` label, which
the job then removes. It skips drafts, PRs that only change docs or Markdown, and PRs
from forks: the repository is public and the job holds a token with write access. It
needs the `CLAUDE_CODE_OAUTH_TOKEN` repository secret. Its comments, issues, and logs
are public.

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
