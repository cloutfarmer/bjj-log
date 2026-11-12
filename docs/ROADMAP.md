# BJJ Log roadmap

## Done

- [x] **Session types (multi-select)** — tag each session as Class, Instructing, Open Mat, Drilling, Competition, or Private. Multiple types allowed per day (e.g., teach kids class + train your own class).

- [x] **"Today" shortcut** — button on the calendar to jump back to today's date.

- [x] **Technique tagging** — each note carries up to five technique tags, each in a broad bucket. Tags are added by hand, from suggestions matched in the note text, or by a model call when no existing tag appears. Near-duplicate tags can be merged from a list of suggestions.

- [x] **Technique index** — the Tags screen lists every tag by bucket with its note count and last-trained date, and opens every note for a tag. Old notes can be tagged there one by one or auto-tagged in a batch.

- [x] **Search (note text)** — the search box on the Tags screen filters tags and finds notes whose text contains the query.

- [x] **Note cleaner** — spelling suggestions for technique names from a built-in glossary, plus a grammar check on request. Each fix is accepted one at a time.

---

## Planned

### High Priority

- [ ] **Export / backup** — "Export JSON" button to download all entries, so you keep a copy outside the database. Consider a periodic auto-export prompt.

### Medium Priority

- [ ] **Training partner tracking** — add partners per session with optional notes (e.g., "Sam: strong top pressure — work guard retention"). View a partner's history and how often you've trained together.

- [ ] **Training stats** — monthly summary: days trained, most-used session types, most-referenced techniques, current streak.

- [ ] **Annual heatmap** — GitHub-style contribution graph showing training frequency across the full year at a glance.

### Nice to Have

- [ ] **AI briefs and summaries** — a daily focus line, a weekly summary, and a monthly recap built from the weekly ones. The three jobs are defined in `lib/ai/jobs/` with their inputs and caps, but nothing calls them yet. To be filled in once there are a few weeks of tagged notes.

- [ ] **Session intensity / condition log** — 1–5 scale for energy level, injury/soreness notes per session. Helps correlate training load with progress.

- [ ] **Print / share view** — clean, printable layout of a date range's entries. Useful for reviewing before a competition or belt test.

- [ ] **Offline use** — open the journal without a connection. Unsaved drafts are already kept in the browser; saved notes are not.
