# Browser tests

Procedures are in the [testing guide](../docs/TESTING.md). Run everything on LOCAL, with
the server using Neon branch `dev`.

| Group | Files | Requirements and effects |
|---|---|---|
| Training stats | `stats.spec.ts` | Pure function tests with made-up dates. No server, browser, or database. Always safe |
| AI core | `ai-core.spec.ts` | Pure function tests with a fake provider and an in-memory store. No server, browser, database, or model call. Always safe |
| Tag index | `tag-index.spec.ts` | Pure function tests with made-up notes: the tag index, note search, and tag suggestions. No server, browser, or database. Always safe |
| Glossary | `glossary.spec.ts` | Pure function tests with made-up sentences. No server, browser, or database. Always safe |
| Layout | `layout.spec.ts` | Needs a running server, `BJJ_PASSWORD`, and Chrome. Mocks `/api/entries`, so it doesn't read or write journal data. Sets test notes in browser localStorage only |
| Access control | `storage.spec.ts`, first test | Needs a running server, `BJJ_PASSWORD`, and Chrome. Requests are rejected before any write, so no data changes |
| **Storage (writes data)** | `storage.spec.ts`, second test | **Creates, edits, imports, and deletes rows in the server's database.** Cleans up after itself. Run only after the [target check](../docs/TESTING.md#browser-tests) |

`npm run test:e2e` runs every group, including the one that writes data.
