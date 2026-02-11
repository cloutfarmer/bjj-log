# CLAUDE.md

## Project Overview

BJJ-Log is a personal Brazilian Jiu-Jitsu training journal. It lets the user select a day from a monthly calendar and write/read journal entries about what they learned in training.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: JavaScript
- **Styling**: CSS Modules + CSS custom properties (dark theme)
- **Storage**: Browser localStorage (key: `bjj-log-entries`)
- **Deployment target**: Vercel

## Project Structure

```
bjj-log/
├── app/
│   ├── components/
│   │   ├── Calendar.js            # Monthly calendar grid with navigation
│   │   ├── Calendar.module.css
│   │   ├── JournalEntry.js        # Read/write journal entry for a selected day
│   │   └── JournalEntry.module.css
│   ├── globals.css                # CSS variables, resets, dark theme
│   ├── layout.js                  # Root layout (metadata)
│   ├── page.js                    # Main page — state, localStorage, wires components
│   └── page.module.css
├── package.json
├── next.config.mjs
├── jsconfig.json                  # Path alias: @/* → ./*
└── CLAUDE.md
```

## Commands

```bash
npm run dev     # Start dev server at http://localhost:3000
npm run build   # Production build (use to verify no errors)
npm run start   # Serve production build
npm run lint    # ESLint
```

## Architecture & Conventions

### Data model
Entries are stored as a flat JSON object in localStorage:
```json
{ "2026-02-11": "Learned a new sweep from half guard..." }
```
Date keys use `YYYY-MM-DD` format.

### Component patterns
- All interactive components are client components (`"use client"`)
- State lives in `page.js` and is passed down as props
- CSS Modules for component-scoped styles; global CSS variables in `globals.css`

### Styling
- Dark theme by default (CSS custom properties in `:root`)
- Key variables: `--bg`, `--bg-card`, `--border`, `--text`, `--text-muted`, `--accent`, `--today`
- System font stack (no external font dependencies)

### Calendar
- Shows one month at a time with prev/next navigation
- Highlights today (green border) and selected date (blue border)
- Blue dot indicator on days that have a journal entry

### Git
- `master` is the default branch
- Feature branches use `claude/` prefix for AI-assisted development

## Key Decisions

- **localStorage over a database**: Sole-user app, keeps things simple with no backend. Can migrate to a DB later.
- **App Router**: Modern Next.js pattern (`app/` directory)
- **No TypeScript yet**: Started with JS for speed; can adopt TS when complexity warrants it
- **No external UI libraries**: Plain CSS Modules to stay lightweight
