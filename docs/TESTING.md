# Testing

[`tests/README.md`](../tests/README.md) lists each test group and what it touches.

## Static checks: always safe

**LOCAL.** These don't touch the database.

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
npm audit
npx playwright test tests/stats.spec.ts tests/ai-core.spec.ts tests/glossary.spec.ts tests/tag-index.spec.ts
```

These four specs test pure functions and open no browser or server. The AI core spec
uses a fake provider, so it makes no model call and spends no tokens.
`npm run build` reads `.env.local` but doesn't apply migrations or change data.

## Preview pages: always safe

**LOCAL.** Run `npm run dev` and open http://localhost:3000/dev for the journal or
http://localhost:3000/dev/tags for the Tags screen. They render the real components with
made-up data from `dev/fixtures.ts`, and need no database, password, or network. Saves and
tag edits stay in memory. They're not part of production builds; after `npm run build`,
no `/dev` route may appear in the route list. Use it for layout checks
and screenshots.

## Browser tests

**LOCAL only.** Never run these against the live site. `npm run test:e2e` runs every spec,
including the one that writes to the database. There is no database-free default command
or automatic target check yet, so check the target by hand.

1. Confirm the target. This must print `NEON_BRANCH=dev`. Otherwise, stop.

   ```bash
   grep '^NEON_BRANCH=' .env.local
   ```

2. Build and start the app. Keep this terminal open.

   ```bash
   npm run build
   npm start -- --hostname 127.0.0.1 --port 3002
   ```

3. In a second terminal, run all the tests or one spec:

   ```bash
   TEST_BASE_URL=http://localhost:3002 npx playwright test
   TEST_BASE_URL=http://localhost:3002 npx playwright test tests/layout.spec.ts
   ```

   The tests use your installed Google Chrome, and read `BJJ_PASSWORD` from `.env.local`.

4. Stop the server, then delete the results folder, because a failed test's page snapshot
   can include journal text:

   ```bash
   rm -rf test-results
   ```

Without `TEST_BASE_URL`, tests go to `http://localhost:3000`, which is whatever server is
running there.

## What the storage test does

`tests/storage.spec.ts` uses two unused dates in the current month. It creates, edits,
imports, and deletes entries, then checks that all entries match the snapshot it took at
the start. It removes its test rows in a `finally` block, so a run killed outright can
still leave rows starting with `Storage verification`. Avoid editing those dates during a
run.

Neon branch `dev` holds a copy of the real journal, so don't share its data or test output.

## Writing tests

- Add a regression test for each bug fix, at the boundary where it failed.
- Use synthetic data. Real journal text never goes into Git.
- Playwright traces stay off, so the journal password and notes aren't recorded.
