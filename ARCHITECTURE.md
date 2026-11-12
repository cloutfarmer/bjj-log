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
or background worker. The app needs an internet connection to read or save: there is no
offline mode. An unsaved draft is kept in the browser until it is saved or discarded.

## Data flow

**Reading.** `app/page.tsx` checks the session and renders `Journal`, or redirects to
`/login`. `Journal` reads the store in `lib/journalStore.ts`, which fetches
`GET /api/entries` once and holds the result in page memory for every screen. The route
returns every entry as an object keyed by date. Each entry carries a `version`, which is
its `updated_at` as 20 digits, and the response carries an `ETag` built from the row
count and the newest version.

**Rechecking.** When the tab becomes visible or focused, at most once every 30 seconds
and never while a draft is open, the store asks again with `If-None-Match`. If nothing
changed, the route answers 304 from one small query and sends no notes. Otherwise the
store adopts the new copy and keeps the existing object for every unchanged entry.
Responses stay `no-store`, so notes are never written to the browser's disk cache.

**Saving.** The editor sends `PUT /api/entries` with one date, one entry, and
`baseVersion`: the version the draft started from, or null for a day that had no entry.
The route checks the session and origin, validates the body, then writes only if the row
is still at that version. If the entry is empty, it deletes the row instead. When the row
has changed, the route writes nothing and answers 409 with the current entry. The editor
keeps the draft, shows the other copy, and lets the user save over it or take it. A
request with no `baseVersion` field saves unconditionally, for a page loaded before
versions existed. Saving with no changes sends nothing.

**Drafts.** While the editor has unsaved changes, `lib/drafts.ts` keeps the draft in
localStorage under `bjj-log-draft:<date>`, with the version it started from. Opening that
day restores it. It is removed when saved or cancelled, and every draft is removed on
sign-out. Saved notes are never stored in the browser.

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
| `lib/entrySync.ts` | Pure version, collection-tag, and merge helpers shared by the route and the browser |
| `lib/journalStore.ts` | The browser's one in-memory copy of the journal, and its recheck |
| `lib/drafts.ts` | Unsaved drafts in browser storage |
| `lib/auth.ts` | Password check, session signing, same-origin check. Server only |
| `lib/db.ts` | Lazily created `pg` pool. Server only |
| `db/migrations/` | Ordered SQL files |
| `scripts/` | Migrations, deployment, and production-secret tools |
| `tests/` | Playwright browser tests |
| `dev/`, `app/dev/page.dev.tsx` | Development-only preview at `/dev`: the real calendar, stats, and entry with made-up fixtures |

Saved entries live in the store; selection and editor state live in `Journal` and pass
down as props. Interactive components are client
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
| A failed or refused save keeps the draft open | Closing the editor would throw away unsaved work |
| A save never replaces a version the editor hasn't seen | A page left open on one device must not silently overwrite a newer note from another |
| An entry never changes under an open draft | The editor resets when its entry changes, so a background recheck would discard the draft |
| Saved notes are held in page memory only; only unsaved drafts are stored in the browser, and sign-out removes them | The journal is private, and a shared or lost device shouldn't keep a copy |
| Builds never apply migrations | Vercel builds shouldn't change a live database as a side effect |
| An applied migration is never edited | `scripts/migrate.mjs` records checksums and rejects changes, so history stays reproducible |
| Migrations run in one transaction under an advisory lock | A failed or concurrent run can't leave the schema half changed |
| Only `prod` deploys to production | `vercel.json` and `scripts/check-deployment.mjs` make release a deliberate step |
| Journal text and credentials stay out of logs and error messages | The notes are private, and logs are copied to other systems |
