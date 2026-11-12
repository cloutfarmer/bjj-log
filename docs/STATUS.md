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

- 2026-11-11, LOCAL, no database, on `feature/ai-notes` (stacked on the agent-kit 1.3.0
  adoption branch): `npm run typecheck`, `npm run lint`, `npm run build`,
  `git diff --check`, and
  `npx playwright test tests/stats.spec.ts tests/ai-core.spec.ts tests/glossary.spec.ts`
  (32 tests) passed. The build listed the six `/api/ai/*` routes and not `/dev`. In the
  `/dev` preview at 390px wide, the tag editor, the spelling suggestions with Accept, the
  tag cleanup list, and the usage table rendered and worked on made-up data.
- 2026-11-11, LOCAL, read-only query on Neon branch `dev`: `bjj_migrations` lists only
  `001_entries.sql` and `002_attire.sql`. `003_ai.sql` was therefore rewritten in place
  for several tags per note before its first apply.
- 2026-11-11, LOCAL, no database, on `feature/ai-notes` after the multi-tag and Tags
  screen work: `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`,
  `node .agent/repository-scan.mjs`, and
  `npx playwright test tests/stats.spec.ts tests/ai-core.spec.ts tests/glossary.spec.ts tests/tag-index.spec.ts`
  (40 tests) passed. The build listed `/tags` and no `/dev` route. Without a session,
  `/tags` redirected and `GET /api/ai/tags` and `PUT /api/ai/tag` answered 401.
- 2026-11-11, LOCAL, `/dev` and `/dev/tags` previews on made-up data, in Chrome at 320,
  390 and 1280px wide: opening a tag from the list and from a chip, Back, note text
  search, the empty search state, adding tags up to the limit of five, removing one,
  one-tap suggestions, tagging a note twice on the Untagged tab, the auto-tag button,
  "Open in journal", and the Journal / Tags navigation all worked, with no horizontal
  overflow and no page errors.
- 2026-11-12, LOCAL, Neon branch `dev`, on `feature/ai-notes`: `003_ai.sql` applied with
  `npm run db:migrate`; `bjj_migrations` lists three files and the five new tables exist.
  A count and aggregate hash of `bjj_entries` were identical before and after everything
  below, so no test changed a note.
- 2026-11-12, LOCAL, Neon branch `dev`, server from `npm run build` and `npm start` on
  port 3002, no `ANTHROPIC_API_KEY`: 50 checks through the `/api/ai/*` routes passed.
  They cover 401 when signed out, 403 on a cross-origin write, input validation, tagging
  by hand, the limit of five, the hand-edit lock, text-match tagging with no model call
  (including a misspelled term matching its tag), the merge cases, and an empty usage
  view. In Chrome the journal and `/tags` worked, hand tagging was offered, and the
  grammar button and model tools were absent or marked as needing a key.
- 2026-11-12, LOCAL, Neon branch `dev`, same server with a key and model
  `claude-haiku-5-5`: in headless Chrome at 1280 and 390px wide, the first load tagged
  five notes, tags showed on the entry and in Recent entries, a tag was added and
  removed by hand, spelling and grammar suggestions were accepted and rejected and
  Cancel left the saved note unchanged, saving a new note tagged it once, clearing it
  removed the entry and its tag rows, and on `/tags` the tag list, one tag's notes,
  "Open in journal", note search, the auto-tag bar over every note, one accepted merge
  and the usage table (equal to `bjj_ai_runs`) all worked with no horizontal overflow.
  A repeat tag or grammar call on unchanged text made no model call. Tagging every note
  once cost about 700 input and 65 output tokens per model call.
  `TEST_BASE_URL=http://localhost:3002 npx playwright test tests/layout.spec.ts` passed.
- 2026-11-12, real-note testing found and fixed four defects, each with a regression test
  on made-up text: the glossary suggested "ankle pick" for the correct "ankle lock"; the
  `tagNote` output cap of 80 tokens cut replies short, so some notes answered 503; the
  `tagNote` prompt attached existing tags that did not fit and chose wrong buckets; and
  `extractJson` failed when a reply had text or brackets after the JSON. The `cleanNote`
  and `tagCleanup` caps were raised for the same reason. After the fixes
  `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`,
  `node .agent/repository-scan.mjs` and
  `npx playwright test tests/stats.spec.ts tests/ai-core.spec.ts tests/glossary.spec.ts tests/tag-index.spec.ts`
  (48 tests) passed.

- 2026-11-12, LOCAL, no database, on `feature/ai-data-flow` (stacked on
  `feature/ai-notes`): `npm run typecheck`, `npm run lint`, `npm run build`,
  `git diff --check`, `node .agent/repository-scan.mjs`, and
  `npx playwright test tests/stats.spec.ts tests/ai-core.spec.ts tests/glossary.spec.ts tests/tag-index.spec.ts`
  (50 tests) passed. `/dev` and `/dev/tags` rendered at 390px wide with no error other
  than the known `/favicon.ico` 404.

## Unverified

- On `feature/ai-data-flow`, the rewritten SQL in `lib/ai/store.ts` (`getTagState`,
  `loadTagContext`, the array inserts in `saveJobTags` and `saveUserTags`) has not run
  against a database. Load `/tags`, add and remove a tag, and auto-tag a note on LOCAL.
- Tag quality on real notes is only partly good. With the version 3 prompt every note got
  plausible tags, but three things were seen and not fixed: a note that mentions one
  existing tag in passing gets only that tag, because a text match skips the model; the
  model sometimes returns no tags for a note it tagged on another run, and an empty
  result is saved; and tag names multiply ("collar choke", "gi choke", "lapel choke").
- Tag cleanup suggestions were poor on the one real list tried: two of three proposed
  merges joined different techniques. Nothing merges without Accept.
- The grammar check found most apostrophe and word errors but missed some plain typos.
- Leaving the journal while the first-load catch-up is running, then loading it again,
  can send the same note to the model twice. Seen once; a save tags exactly once.
- `/favicon.ico` answers 404. It predates the tag work.
- Sign-in fails at `http://127.0.0.1:<port>` with 403; use `http://localhost:<port>`.
- `tests/ai-sample.spec.ts` was not run; the cost was measured on the real notes instead.
- Nothing here has run on PRODUCTION. `003_ai.sql` is applied on Neon `dev` only, and
  PRODUCTION has no `ANTHROPIC_API_KEY`.
- `feature/ai-notes` is stacked on `feature/agent-kit-1.3.0`, which is not in `dev` yet.
  It needs a rebase on `origin/dev` once the adoption lands.
- The `delegate` module ran on this branch: seven briefs on 2026-11-11 and four on
  2026-11-12, each merged after its done-check passed on the task branch. One brief was
  sent back once because two of its steps contradicted each other.

- The `ci`, `kit-check`, `agent-brief`, and `agent-tripwire` workflows have not run on
  GitHub yet. They first run on the pull request that adds them.
- `kit-check` clones the kit at tag `v1.3.0`. On 2026-11-11 the newest kit tag was
  `v1.2.0`, so `kit-check` can't finish until `v1.3.0` is tagged.
- Browser tests (`tests/layout.spec.ts`, `tests/storage.spec.ts`) were not run for the
  adoption: they need a development database, and the change touches no app code.
- `dev` at `0282484` (the `/dev` preview page) is not released. `prod` is one pull request
  behind it.

## Blocked

Nothing recorded.

## Next

Tag kit `v1.3.0`, open the adoption pull request into `dev`, and confirm all four
workflows report on it.

For tags and the AI features: decide whether a text match should still skip the model
when a key is set, then land `feature/ai-notes` after the adoption branch. Releasing it
needs `003_ai.sql` applied on PRODUCTION and a production `ANTHROPIC_API_KEY`; ask for
the runbook first.
