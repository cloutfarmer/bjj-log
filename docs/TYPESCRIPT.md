# TypeScript in this project

React still renders the interface. TypeScript checks the JavaScript we write before it runs; it does not change the stored note format or add runtime validation automatically.

## Files to read first

- `app/types.ts`: the shared journal data model.
- `app/components/Calendar.tsx`: component props, callback types, and nullable selections.
- `app/components/JournalEntry.tsx`: inferred state types and narrowing before saving.
- `app/components/Journal.tsx`: typed collections and cloud loading; `app/page.tsx` checks the session before rendering it.
- `app/layout.tsx`: framework types (`Metadata`) and renderable children (`ReactNode`).

The root `app/` directory is the active application. `src/app/` contains an unused starter template, also converted so all React source is typed. Configuration files remain `.mjs` because they are executable JavaScript configuration, not React components.

## The details

**`.tsx` versus `.ts`.** Use `.tsx` when a file contains JSX, such as `<Calendar />`. Use `.ts` for ordinary types or logic without JSX.

**Interfaces describe object shapes.** `JournalEntryData` requires `text: string` and `sessionTypes: string[]`. An interface does not create an object or validate JSON at runtime.

**Unions express alternatives.** `StoredEntry = string | JournalEntryData` accepts both historical note formats. `typeof val === "string"` narrows that union, allowing TypeScript to understand which format is being handled.

**Null is explicit.** `useState<string | null>(null)` means the selection is initially absent and may later be a date string. Without the generic argument, TypeScript would infer only `null`. The save handler checks for `null` before passing the date to a callback that requires a string.

**Inference avoids redundant annotations.** `useState(false)` already produces boolean state. `useState(savedEntry.text)` already produces string state. Parameter types are explicit where TypeScript cannot infer them from their callers.

**Callbacks describe an agreement.** `(date: string, entry: JournalEntryData) => void` means a function accepting those arguments whose return value the caller does not use.

**Collections describe their contents.** `Record<string, StoredEntry>` maps date keys to entries. It does not enforce the YYYY-MM-DD format or guarantee that a particular key exists. `normalizeEntry` explicitly accepts `undefined` for missing entries. `ReadonlySet<string>` lets the calendar inspect saved dates without modifying the set through that prop.

**Session tags remain strings.** A closed union of known tag names could catch spelling errors in new code, but existing saved entries may contain unfamiliar tags. The current implementation deliberately preserves their display behavior.

**Type-only imports disappear.** `import type` makes it clear that an import is needed only by the compiler, not at runtime.

**Strict checking catches mistakes early.** `strict: true` enables checks including implicit `any` and null handling. `noEmit: true` makes TypeScript check only; Next.js handles compilation. `allowJs: false` keeps application source in TypeScript.

## A boundary to understand

`JSON.parse` returns `any`; a type annotation does not validate it. The cloud integration now uses `lib/entries.ts` to accept `unknown`, inspect fields, and return either a valid entry or `null`. Both new writes and legacy imports use this runtime validator. API responses from our own server are typed in the client, but those annotations themselves still do not perform runtime validation.

## Try it

Run `npm run typecheck`. Temporarily change `text: string` to `text: number`, or pass a number as the selected date, and read the compiler errors. Undo the experiment afterward. Run `npm run lint` for lint checks and `npm run build` for production verification.
