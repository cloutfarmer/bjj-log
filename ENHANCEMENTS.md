# BJJ Log — Future Enhancements

## In Progress / Completed

- [x] **Session types (multi-select)** — tag each session as Class, Instructing, Open Mat, Drilling, Competition, or Private. Multiple types allowed per day (e.g., teach kids class + train your own class).

---

## Planned

### High Priority

- [ ] **Search** — full-text search bar that scans all entries across all dates. Essential for finding "what did I write about X technique" without clicking each day.

- [ ] **Technique dictionary / index** — a dedicated page listing every technique tag you've used, each linking to every session where it appeared. Your own personal curriculum tracker.

- [ ] **Technique tagging in entries** — structured tag input (e.g., `#triangle`, `#half-guard-sweep`) alongside the freeform notes, which feeds the dictionary above.

- [ ] **Export / backup** — "Export JSON" button to download all entries. Protects against localStorage being wiped on browser clear. Consider periodic auto-export prompt.

### Medium Priority

- [ ] **Training partner tracking** — add partners per session with optional notes (e.g., "Alex: strong top pressure — work guard retention"). View a partner's history and how often you've trained together.

- [ ] **Training stats** — monthly summary: days trained, most-used session types, most-referenced techniques, current streak.

- [ ] **Annual heatmap** — GitHub-style contribution graph showing training frequency across the full year at a glance.

- [ ] **"Today" shortcut** — small button on the calendar to jump back to today's date without navigating months.

### Nice to Have

- [ ] **AI session summarizer** — Claude API integration: reads a month's entries and outputs a short "here's what you focused on, patterns in your notes, things to drill more" summary. Requires API key + small server endpoint.

- [ ] **Session intensity / condition log** — 1–5 scale for energy level, injury/soreness notes per session. Helps correlate training load with progress.

- [ ] **Print / share view** — clean, printable layout of a date range's entries. Useful for reviewing before a competition or belt test.

---

## Notes

- Data is stored in `localStorage` under key `bjj-log-entries`. All new structured fields are stored as JSON objects; plain-text legacy entries are auto-migrated on load.
- Keep the app deployable to Vercel with no backend unless a specific feature genuinely requires one (e.g., AI summarizer).
