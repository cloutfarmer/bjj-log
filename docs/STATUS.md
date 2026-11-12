# Status

Each entry gives the date, environment, what ran, and the result.

## Verified

- 2026-11-08, PRODUCTION: `prod` at `639a36b` deployed. The commit's Vercel status on
  GitHub reads "Deployment has completed".
- 2026-11-11, LOCAL, no database, on the agent-kit 1.3.0 adoption branch (`dev` at
  `0282484` plus the kit files): `npm run typecheck`, `npm run lint`, `npm run build`,
  `git diff --check`, `node .agent/repository-scan.mjs`, and
  `npx playwright test tests/stats.spec.ts` passed. `/dev` was not in the build's route
  list. The kit's `check` passed against kit 1.3.0, and `.agent/freshness.mjs` ran.

## Unverified

- The `ci`, `kit-check`, `agent-brief`, and `agent-tripwire` workflows have not run on
  GitHub yet. They first run on the pull request that adds them.
- `kit-check` clones the kit at tag `v1.3.0`. On 2026-11-11 the newest kit tag was
  `v1.2.0`, so `kit-check` can't finish until `v1.3.0` is tagged.
- The `delegate` module is on, but no brief has been sent to a `worker` yet. A worker
  reads `AGENTS.md` and `.agent/policy.yml` from committed history, so it can't be tried
  until the adoption is committed.
- Browser tests (`tests/layout.spec.ts`, `tests/storage.spec.ts`) were not run for the
  adoption: they need a development database, and the change touches no app code.
- `dev` at `0282484` (the `/dev` preview page) is not released. `prod` is one pull request
  behind it.

## Blocked

Nothing recorded.

## Next

Tag kit `v1.3.0`, open the adoption pull request into `dev`, and confirm all four
workflows report on it.
