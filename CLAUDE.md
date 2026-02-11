# CLAUDE.md

## Project Overview

BJJ-Log is a Brazilian Jiu-Jitsu training log application built with Next.js (App Router). The project was bootstrapped with `create-next-app` and is in its initial setup phase.

## Tech Stack

- **Framework**: Next.js (App Router — `app/` directory)
- **Language**: JavaScript (`app/page.js`)
- **Font**: Geist via `next/font`
- **Deployment target**: Vercel

## Project Structure

```
bjj-log/
├── README.md          # Next.js bootstrap docs
├── CLAUDE.md          # This file — AI assistant guidance
└── app/               # (to be created) Next.js App Router pages and layouts
    └── page.js        # Main entry page
```

> **Note**: The project currently contains only README.md. The full Next.js scaffold
> (package.json, app/, public/, etc.) has not yet been committed.

## Development Commands

```bash
npm run dev     # Start development server on http://localhost:3000
npm run build   # Production build
npm run start   # Start production server
npm run lint    # Run linter (if configured)
```

## Conventions

### Code Style
- Use the Next.js App Router pattern (layouts, pages, loading, error boundaries in `app/`)
- Prefer functional React components
- Use `next/font` for font loading (Geist is the chosen font)

### File Naming
- Pages and layouts follow Next.js App Router conventions: `page.js`, `layout.js`, `loading.js`, `error.js`
- Components should be PascalCase (e.g., `TrainingLog.js`)

### Git
- `master` is the default branch
- Feature branches use the `claude/` prefix for AI-assisted development

## Key Decisions

- **App Router over Pages Router**: The project uses the modern Next.js App Router (`app/` directory), not the legacy `pages/` directory
- **JavaScript**: The project references `.js` files, not `.ts` — TypeScript is not currently in use
