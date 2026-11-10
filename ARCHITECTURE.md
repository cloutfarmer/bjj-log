# Architecture

## Purpose

BJJ Log is a private training journal for one person. You pick a day on a calendar
and read or write what you learned in that session. It is built for phone-first use
through a browser and has no public accounts.

## Runtime shape

```text
Browser (React client components)
   |  same-origin fetch, signed session cookie
   v
Next.js App Router on Vercel (Node.js functions, iad1)
   |  pooled Postgres connection, server only
   v
Neon Postgres: table bjj_entries
```

The website and API deploy together as one Next.js app. There is no separate backend
or background worker. The app needs an internet connection: there is no offline mode,
and a draft is lost if the page closes before a successful save.

## Data flow

**Reading.** `app/page.tsx` checks the session and renders `Journal`, or redirects to
`/login`. `Journal` fetches `GET /api/entries`, which returns every entry as an object
keyed by date.

**Saving.** The editor sends `PUT /api/entries` with one date and one entry. The route
checks the session and origin, validates the body, then upserts the row. If the entry
is empty, it deletes the row instead.

**Importing.** Before the cloud version, notes lived in browser localStorage under
`bjj-log-entries`. If they are still there, `Journal` offers an import, which sends
them to `POST /api/entries/import`. The whole request is one SQL statement, so it
either fully applies or doesn't apply at all.

**Signing in.** `POST /api/login` compares the password with `BJJ_PASSWORD` and sets a
signed, expiring, HttpOnly, SameSite=Strict cookie. The signature includes a password
fingerprint, so changing the password or `BJJ_SESSION_SECRET` ends every session.

## Data model

One row per training day, in `bjj_entries`:

| Column | Type | Notes |
|---|---|---|
| `entry_date` | `date`, primary key | Sent over HTTP as `YYYY-MM-DD` |
| `text` | `text` | Up to 50,000 characters |
| `session_types` | `text[]` | Up to 20. Open-ended, so unfamiliar older tags still display |
| `attire` | `text`, nullable | `gi` or `nogi`. Null means not recorded |
| `updated_at` | `timestamptz` | Set on each save |

## Modules

| Path | Responsibility |
|---|---|
| `app/page.tsx`, `app/login/page.tsx` | Server pages: session check and sign-in form |
| `app/components/Journal.tsx` | Client state: entries, selected date, saving, and import |
| `app/components/Calendar.tsx` | Week view that expands to a full month, plus the attire legend |
| `app/components/JournalEntry.tsx` | Read and edit views for the selected day |
| `app/components/{atoms,molecules,organisms}/` | New presentational components, one folder each, grouped by atomic-design level (for example `organisms/TrainingStats`) |
| `lib/stats.ts` | Pure training-stat calculations: week, month, week streak, total, gi/no-gi split |
| `app/types.ts` | Shared entry types and attire options |
| `app/api/` | HTTP routes: entries, import, login, logout |
| `lib/entries.ts` | Runtime validation of untrusted entry data |
| `lib/auth.ts` | Password check, session signing, same-origin check. Server only |
| `lib/db.ts` | Lazily created `pg` pool. Server only |
| `db/migrations/` | Ordered SQL files |
| `scripts/` | Migrations, deployment, and production-secret tools |
| `tests/` | Playwright browser tests |
| `dev/`, `app/dev/page.dev.tsx` | Development-only preview at `/dev`: the real calendar, stats, and entry with made-up fixtures |

State lives in `Journal` and passes down as props. Interactive components are client
components. Styling uses CSS Modules with dark-theme variables from `app/globals.css`
and the system font stack, with no UI library or external font. In the calendar, today
has a green highlight and the selected day a blue one. Entry dots are tinted by attire
and stay blue when none is recorded.

## Boundaries

- Browser code reaches data only through `/api/*`. It never sees database credentials.
- `lib/entries.ts` is safe on both sides, and `Journal` uses it to read old browser
  notes. `lib/auth.ts` and `lib/db.ts` import `server-only`.
- `DATABASE_URL` (pooled) serves the app. `DATABASE_URL_UNPOOLED` (direct) is used only
  by `scripts/migrate.mjs`.
- Local development and production use separate Neon branches.
- The `/dev` preview exists only under `next dev`. `next.config.mjs` adds the
  `page.dev.tsx` extension only in development, so production builds never compile the
  page or its fixtures. It reads no session, database, or network.

## Invariants

| Invariant | Why |
|---|---|
| Every data endpoint checks the session itself | There is no middleware, so a route that skips the check exposes the whole journal |
| Every write also checks the origin | The session cookie alone doesn't prove the request came from this site |
| Input is validated at runtime by `lib/entries.ts` | TypeScript types don't exist at runtime, and HTTP and localStorage data can be anything |
| Import never overwrites a cloud entry and leaves the browser copy alone | Old browser notes must never replace newer work, and a retry must be safe |
| An entry with no text, no session types, and no attire is deleted, using the same rule on client and server | A session can be logged by attire alone, and the two sides must agree on whether a day exists |
| A failed save keeps the draft open | A draft exists only in the page, so closing the editor would lose it |
| Builds never apply migrations | Vercel builds shouldn't change a live database as a side effect |
| An applied migration is never edited | `scripts/migrate.mjs` records checksums and rejects changes, so history stays reproducible |
| Migrations run in one transaction under an advisory lock | A failed or concurrent run can't leave the schema half changed |
| Only `prod` deploys to production | `vercel.json` and `scripts/check-deployment.mjs` make release a deliberate step |
| Journal text and credentials stay out of logs and error messages | The notes are private, and logs are copied to other systems |
