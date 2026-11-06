# Neon storage

The app stores its data in a Neon Postgres project. Only Postgres is declared in `neon.ts`. Neon doesn't host the website; that's Vercel.

## Branches

| Neon branch | Used by | Notes |
|---|---|---|
| `production` | The live site | The default branch |
| `dev` | LOCAL, through `.env.local` and `.neon` | Started as a copy of `production`, including journal entries. It has no expiry |

Check the local target at any time. It must print `NEON_BRANCH=dev`:

```bash
grep '^NEON_BRANCH=' .env.local
```

`neon checkout`, `neon deploy`, and `neon env pull` write Neon variables into `.env.local` for the linked branch, and leave other lines alone. Never run `neon checkout production` in this folder: local saves, tests, and migrations would then reach the real journal.

`neon.ts` gives new branches created with `neon checkout <name> --create` a 7-day expiry. Use `neon branches create --name <name> --parent production --no-secrets` for a branch that should last.

## Connections

`DATABASE_URL` is the pooled application connection. `DATABASE_URL_UNPOOLED` is used only by the migration script. Both stay on the server, and neither should ever use a `NEXT_PUBLIC_` prefix. `NEON_BRANCH` is CLI metadata, not an application credential.

## Migrations

Files in `db/migrations/` run in name order: `001_entries.sql` creates the table, and `002_attire.sql` adds attire. `scripts/migrate.mjs` runs them in one transaction, records checksums, and takes a lock so two runs can't overlap. Builds never apply migrations. On LOCAL, run `npm run db:migrate`.

## Existing browser notes

The app offers **Import browser notes** when it finds the old `bjj-log-entries` localStorage key. The import is atomic and adds only dates not already in Postgres. Existing cloud dates win; the original browser data is left unchanged. Repeating the import is safe.

Browser storage belongs to an origin (scheme + hostname + port). To import notes saved at `http://localhost:3000`, open the app at that same address in the same browser. Note that from LOCAL this imports them into Neon `dev`, not the live journal. Notes saved on an iPhone at a LAN address must be imported from that same origin. They won't automatically appear at a new hosted URL until imported from their original browser and origin. Malformed imports are rejected without deleting the originals.

## Limits of the password gate

The password gate is intentionally for this personal app. It isn't a multiuser account system, there is no signup or password recovery, and Neon Auth isn't enabled. Keep your password in a password manager.
