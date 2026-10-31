# Neon storage

The app is linked to Neon project `your-neon-project`, branch `production`. Only Postgres is declared in `neon.ts`. `neon deploy` configures backend services and pulls environment variables; it does **not** host this Next.js website. Vercel hosting is a separate step.

## Local setup

1. Authenticate with `neon login` if necessary.
2. Run `neon deploy` to populate `.env.local`.
3. Set `BJJ_PASSWORD` in `.env.local` to a strong, unique password (at least 12 characters before public hosting). Set `BJJ_SESSION_SECRET` to a separate random value of at least 32 characters. Initial setup generated one locally; view it in your editor and save it in your password manager. Do not paste it in chat or Git.
4. Run `npm run db:migrate` once to create/update the database schema.
5. Run `npm run dev`, open the app, and enter the journal password. The development server uses `.next-dev`; production builds use `.next` so they can coexist.

`DATABASE_URL` is the pooled application connection. `DATABASE_URL_UNPOOLED` is used only by the migration script. Both stay on the server. Neither should ever use a `NEXT_PUBLIC_` prefix. `NEON_BRANCH` is CLI metadata, not an application credential.

## What changed

- `lib/db.ts` lazily creates a small `pg` connection pool, with Vercel Fluid compute lifecycle support through `attachDatabasePool`.
- `app/api/entries/route.ts` reads and upserts individual dates with parameterized SQL. Saving an empty note with no session tags deletes that date, matching the original journal behavior.
- `app/components/Journal.tsx` loads notes from the API. Save errors leave the editor open. This is online storage, not a complete offline-sync implementation: a draft is still lost if the page is closed/reloaded before a successful save.
- `lib/entries.ts` validates untrusted data at runtime. TypeScript alone cannot validate HTTP or localStorage JSON.
- `db/migrations/001_entries.sql` defines one row per training day, preserving the existing model. `scripts/migrate.mjs` runs migrations transactionally, records their checksums, and uses a transaction lock to prevent simultaneous migration runs.
- `lib/auth.ts` protects this single-owner journal with your chosen password, a separate random session-signing secret, and a signed, expiring, HttpOnly, SameSite=Strict cookie. Production cookies require HTTPS. All data endpoints check authentication independently; write endpoints also require a matching Origin. Changing the password or session secret invalidates all sessions. There is no public signup or password recovery; keep your password in a password manager.

The password access gate is intentionally for this personal prototype. It is not a multiuser account system. Neon Auth is not enabled, and the app never exposes database credentials to the browser.

## Existing browser notes

The app offers **Import browser notes** when it finds the old `bjj-log-entries` localStorage key. The import is atomic and adds only dates not already in Postgres. Existing cloud dates win; the original browser data is left unchanged. Repeating the import is safe.

Browser storage belongs to an origin (scheme + hostname + port). To import notes saved at `http://localhost:3000`, open this updated app at that same address in the same browser. Notes saved on an iPhone at a LAN address must be imported from that same origin. They will not automatically appear at a new hosted URL until imported from their original browser/origin. Malformed imports are rejected without deleting the originals.

## Verification

```bash
npm run build
npm run typecheck
npm run lint
npm start -- --hostname 127.0.0.1 --port 3002
# In a second terminal; requires Google Chrome installed:
TEST_BASE_URL=http://localhost:3002 npm run test:e2e
```

The tests use fresh browser contexts and two unused dates in the current month. They verify authentication, invalid input, cross-origin rejection, create/edit/reload, a second browser reading the same cloud entry, failed-save retention, legacy import, conflict preservation, idempotent import, and deletion. They remove their test rows in `finally` and compare all entries to the original snapshot. Avoid editing those dates during a test run. Traces are disabled to avoid recording the journal password.

Before a production migration, create a temporary Neon branch and pull its env into an ignored file:

```bash
neon branches create --name storage-check --parent production --no-secrets
neon env pull --branch storage-check --file .env.neon-test --services postgres
node --env-file=.env.neon-test scripts/migrate.mjs
node --env-file=.env.neon-test node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3001
# In a second terminal:
TEST_BASE_URL=http://localhost:3001 npm run test:e2e
```

The test runner reads the journal password from `.env.local`. The test server gets database variables from `.env.neon-test` and the password from `.env.local`. Explicit process variables take precedence. Delete only your temporary branch when finished. Do not run migrations as part of `next build`; builds should not mutate the database.

## Hosting later

For Vercel, configure `DATABASE_URL`, `BJJ_PASSWORD`, and `BJJ_SESSION_SECRET` as server environment variables and enable Fluid compute. Keep preview deployments away from the production database. Apply migrations separately with the direct URL, then deploy the tested build. Use the hosted HTTPS URL on your iPhone. No custom domain is needed.

## CLI side effects

The requested `neon init` installed Neon plugins/skills and configured MCP clients globally. It also minted the account-wide MCP API key named `a Neon MCP key` (ID redacted). This key is not used by the journal runtime. The CLI reported that it can reach all resources accessible to your Neon account. If you later remove those MCP integrations, revoke it using `neon api-keys revoke`.
