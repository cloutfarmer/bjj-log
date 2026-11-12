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
Neon Postgres: bjj_entries, plus the AI tables

Next.js server only, and only from lib/ai/provider.ts
   |  HTTPS, API key from the server environment
   v
Anthropic Messages API (optional: without a key the journal works untagged)
```

The website and API deploy together as one Next.js app. There is no separate backend
or background worker. The app needs an internet connection to read or save: there is no
offline mode. An unsaved draft is kept in the browser until it is saved or discarded.

## AI layer

AI organises notes and suggests fixes. It never writes note text. Token use is the main
constraint, so anything that plain code can do makes no model call.

- **One path to a model.** `runJob` in `lib/ai/run.ts` is the only caller of a provider.
  Each job in `lib/ai/jobs/` has a fixed input builder, an output validator, a short
  system prompt, and a hard output-token cap. The jobs are `tagNote`, `cleanNote`,
  `tagCleanup`, and three registered but not yet called: `dailyBrief`, `weeklySummary`,
  `monthlyRecap`.
- **Saved outputs.** Each output is stored with a hash of the job name, prompt version,
  and input. A matching hash returns the saved output with no call. A reply the
  validator rejects is saved as a failure marker under the same hash: the input is sent
  once more, and after two unusable replies it fails with no call until the input or
  the prompt version changes. A failed usage log never discards a reply.
- **One context builder.** `lib/ai/context.ts` turns notes into one compact line each and
  does all counting. `lib/nextItems.ts` reads next-time items from lines that start with
  `next:`; `[x]` or a trailing `(done)` marks one done.
- **Tagging.** A note carries up to five tags. After a successful save the browser asks
  `POST /api/ai/tag` without waiting for it. The server reads the note itself. It skips
  a note whose tags were changed by hand and an unchanged note, then matches every
  existing tag name found in the text, with a plural or verb ending allowed ("armbars")
  and a mention right after a cue like "like an" or "instead of" ignored. It calls
  `tagNote` only when no tag matches or a glossary technique with no tag is mentioned
  at least as often as the top matched tag, and saves the matches then the model's
  tags, five at most. A save that leaves the text unchanged asks for nothing.
  Notes never checked are picked up on a later page load, five at most, or all at once
  from the Untagged tab of the Tags screen. Catch-up skips a note that fails and stops
  after two failures in a row.
- **Few queries.** `GET /api/ai/tags` reads everything in one statement (`getTagState`
  in `lib/ai/store.ts`), and both tag handlers read their note, its tags, and the known
  tags in one (`loadTagContext`). Tag rows are written as arrays, one statement for any
  number of tags. Known tag names go to the model sorted, so the same tags always give
  the same input hash.
- **Hand tagging.** `PUT /api/ai/tag` replaces a note's whole tag set. Each add or remove
  in the tag editor saves at once, on the journal and on the Tags screen. It needs no
  model and no key. The editor also offers existing tags found in the note text as
  one-tap suggestions, computed in the browser by `suggestTags` in `lib/tagIndex.ts`.
- **Lookup.** The Tags screen at `/tags` is built in the browser from data already
  loaded: `buildTagIndex` groups tags by bucket with a note count and the last date, and
  `searchNotes` matches note text. Neither makes a request or a model call.
- **Cleaning.** `lib/glossary.ts` suggests spelling fixes for technique names in the
  browser with no call. A grammar check runs `cleanNote` only when its button is pressed.
  Accepting a suggestion changes the editor draft, which the user then saves.
- **Tag cleanup.** `tagCleanup` receives tag names and counts, never note text, and
  returns suggested merges. A merge happens only when the user accepts it.
- **Cost.** Every model call records its job, model, and input and output token counts
  in `bjj_ai_runs`.
- **Model choice.** `AI_MODEL` sets the model for every job, and `AI_MODEL_<JOB>` for
  one. `lib/ai/provider.ts` sends thinking disabled so the output cap is a true cap; a
  model that rejects that setting needs a provider change.

## Data flow

**Screens.** Each screen has its own route, and one navigation links the four main ones:
a bottom tab bar at 768px and below, header links above that.

| Route | Screen |
|---|---|
| `/` | Journal: the week strip, the selected day's entry, and recent entries |
| `/calendar` | Calendar: the month grid, training stats, and the attire legend |
| `/tags` | Tags: search and every tag by bucket |
| `/tags/<name>` | One tag: every note that carries it |
| `/untagged` | Untagged: notes with no tag, auto-tagging, tag cleanup, and token usage |

**Reading.** `app/(app)/layout.tsx` checks the session and wraps every screen in one
`JournalProvider` and one `AppShell`, or redirects to `/login`. Each page checks the
session again, because a layout doesn't re-run on client navigation. The provider reads
the store in `lib/journalStore.ts`, which fetches `GET /api/entries` once and holds the
result in page memory, and it fetches `GET /api/ai/tags` once. It stays mounted while the
user moves between screens, so the entries, tags, and selected day are kept. The route
returns every entry as an object keyed by date. Each entry carries a `version`, which is
its `updated_at` as 20 digits, and the response carries an `ETag` built from the row
count and the newest version.

**Looking up.** The selected tag lives in the path, so Back works and a tag chip anywhere
links straight to its notes. Picking a day on the Calendar screen selects it and opens
the journal. "Open in journal" links to `/?date=YYYY-MM-DD`; the journal selects that day
and removes the parameter.

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
day restores it. It is removed when saved or cancelled, when the user agrees to discard
it by picking another day or another screen, and every draft is removed on sign-out.
Leaving the journal with the browser's Back button keeps it. Saved notes are never stored
in the browser.

**Importing.** Before the cloud version, notes lived in browser localStorage under
`bjj-log-entries`. If they are still there, `JournalProvider` offers an import, which sends
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

AI output and tags live in five separate tables, added by `db/migrations/003_ai.sql`:

| Table | Contents |
|---|---|
| `bjj_tags` | Tag name and its bucket. The bucket belongs to the tag and is chosen once |
| `bjj_entry_tags` | One row per tag on a day, and who set it (`code`, `ai`, or `user`). At most five per day, enforced in `app/api/ai/tag/route.ts` |
| `bjj_entry_tag_state` | One row per day that tagging has looked at: the hash of the note text the tags came from, and `by_user`, set once the tags are changed by hand. No job touches a `by_user` day. A row with no tags means "checked, none" or "all removed by hand" |
| `bjj_ai_outputs` | The latest output of each job for each scope, with its input hash |
| `bjj_ai_runs` | One row per model call: job, model, and token counts. No text |

## Modules

| Path | Responsibility |
|---|---|
| `app/(app)/layout.tsx`, `app/(app)/**/page.tsx`, `app/login/page.tsx` | Server layout and pages: session check, then the shared shell, one screen, or the sign-in form |
| `lib/useJournal.tsx` | `JournalProvider` and the `useJournal()` hook: entries, selected date, saving, import, the unsaved-draft check, and tag state, shared by every screen. Also the screen links |
| `app/components/Journal.tsx` | The Journal screen |
| `app/components/organisms/Calendar/` | `WeekStrip` for the journal, `MonthGrid` and `CalendarScreen` for the Calendar screen, and the attire legend |
| `app/components/organisms/AppShell/`, `organisms/AppNav/` | The frame around every screen: skip link, brand, sign out, loading and error messages, and the four-link navigation with a check for an unsaved draft |
| `app/components/organisms/RecentEntries/` | The recent-entries list on the Journal screen |
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
| `lib/ai/` | The AI layer: `run.ts`, `jobs/`, `context.ts`, `hash.ts`, `tagMatch.ts`, and `buckets.ts` are pure and take the store and provider as arguments. `config.ts`, `provider.ts`, and `store.ts` are server only |
| `lib/glossary.ts`, `lib/nextItems.ts` | Pure: technique-name spelling suggestions, and next-time items parsed from note text |
| `lib/aiClient.ts` | Browser helpers for `/api/ai/*`. They return null on any failure and never throw |
| `lib/useTagState.ts` | Client hook used once, by `JournalProvider`: tag state, auto-tag, add and remove, and the props for `TagEditor` |
| `lib/tagIndex.ts` | Pure: the tag index, note text search, and tag suggestions from note text |
| `app/components/organisms/TagIndex/` | `TagList`, `TagDetail`, and `UntaggedList`: the Tags, tag, and Untagged screens. `NoteList` and `NoteCard` show notes with their tag editors |
| `app/api/ai/` | HTTP routes for tags, tagging, the grammar check, tag cleanup and merge, and token usage |
| `db/migrations/` | Ordered SQL files |
| `scripts/` | Migrations, deployment, and production-secret tools |
| `tests/` | Playwright browser tests |
| `dev/`, `app/dev/**/*.dev.tsx` | Development-only previews under `/dev`: every screen's real components inside `PreviewProvider`, which fills the same context with made-up fixtures |

Saved entries live in the store in `lib/journalStore.ts`. `JournalProvider` reads it and adds
the selected day, saving, and tag state, and screens read all of it with `useJournal()`.
Editor state lives in `JournalEntry`. Interactive components are client
components. Styling uses CSS Modules with dark-theme variables from `app/globals.css`
and the system font stack, with no UI library or external font. In the calendar, today
has a green highlight and the selected day a blue one. Entry dots are tinted by attire
and stay blue when none is recorded.

## Boundaries

- Browser code reaches data only through `/api/*`. It never sees database credentials.
- `lib/entries.ts` is safe on both sides, and `JournalProvider` uses it to read old
  browser notes. `lib/auth.ts` and `lib/db.ts` import `server-only`.
- `DATABASE_URL` (pooled) serves the app. `DATABASE_URL_UNPOOLED` (direct) is used only
  by `scripts/migrate.mjs`.
- Local development and production use separate Neon branches.
- Note text leaves the app only through `lib/ai/provider.ts`, to the configured model
  provider, and only for `tagNote` and `cleanNote`. Components hold no prompt text and
  never call a provider. `ANTHROPIC_API_KEY` is read on the server only.
- If the key or the AI tables are missing, `/api/ai/*` answers 503 and the journal works
  as it did before, with no tag UI.
- The `/dev` previews exist only under `next dev`. `next.config.mjs` adds the
  `dev.tsx` extension only in development, so production builds never compile the
  preview layout, pages, or fixtures. They read no session, database, or network.
  `tsconfig.json` leaves out `.next-dev/types/validator.ts`, the development server's
  generated route check, because it names the preview layout that a production build
  doesn't have.

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
| AI code never writes `bjj_entries.text` | A model can be wrong, so every text change must be an edit the user made and saved |
| Every model call goes through `runJob` | One place enforces the output cap, the saved-output check, and token logging |
| A save never waits on AI | Tagging can be slow or fail, and a note must still save |
| Once a note's tags are changed by hand, no job changes them again | A correction that gets undone is worse than no tagging |
| Tag lookup and search run in the browser on loaded data | Finding a note must be instant and must never cost tokens |
| Nothing merges tags without an explicit accept | A wrong merge rewrites many notes' tags at once |
