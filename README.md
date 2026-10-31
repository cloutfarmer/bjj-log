# BJJ Log

A private Brazilian jiu-jitsu training journal built with Next.js, React, TypeScript, and Neon Postgres.

Live journal: https://your-deployment.example (password required).

## Local development

```bash
npm ci
cp .env.example .env.local
```

Fill in `.env.local` with your development database connection, journal password, and session secret. Use a separate development database; local saves, migrations, and tests can change data. Never commit credentials.

```bash
npm run db:migrate
npm run dev
```

Open http://localhost:3000. Migration setup and browser-note import instructions are in [Neon setup](docs/NEON.md).

## Branches and releases

- `dev`: integration branch for ongoing development. Start feature branches here and merge reviewed work back here.
- `prod`: release branch for verified versions approved for production.
- `main`: retained as the existing repository history/default branch until the remote default branch is deliberately changed.

Deploy with `npm run deploy:prod` from a clean, published `prod` checkout. Branch names alone do not deploy the app. See [the development and release workflow](docs/WORKFLOW.md) for commands, checks, and remote setup.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm audit
```

Run `npm run test:e2e` against an isolated test database with the environment described in [Neon setup](docs/NEON.md). Review audit findings before a commit; avoid automatic forced dependency upgrades.

## Where to make changes

| Area | Start here |
| --- | --- |
| Journal UI and editor | `app/components/Journal.tsx`, `app/components/JournalEntry.tsx` |
| Calendar | `app/components/Calendar.tsx` |
| Shared entry attributes | `app/types.ts` |
| API requests | `app/api/entries/route.ts` |
| Database reads and writes | `lib/entries.ts`, `lib/db.ts` |
| Database schema changes | `db/migrations/` |
| Login and sessions | `lib/auth.ts`, `app/api/login/route.ts` |
| Browser tests | `tests/storage.spec.ts` |

For an entry attribute such as gi/no-gi, follow it through the shared type, editor, API validation, database queries, and migration. See [the documentation index](docs/README.md) for setup and learning guides.
