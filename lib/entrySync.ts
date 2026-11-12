import type { JournalEntryData, SavedEntry } from "../app/types";

/* Pure helpers shared by the entries route, the browser store, and the tests. Nothing
 * here touches the network, the database, or browser storage. */

/** A version is the row's updated_at as 20 digits: YYYYMMDDHHMMSS plus microseconds, in UTC. */
export function isVersion(value: unknown): value is string {
  return typeof value === "string" && /^\d{20}$/.test(value);
}

/**
 * Identifies the whole collection. Every write stamps updated_at with the current time,
 * so an insert or update raises the newest version and a delete lowers the count.
 */
export function collectionTag(count: number, newest: string | null): string {
  return `"${count}-${newest ?? "0"}"`;
}

/** Proxies that compress a response may mark its tag as weak; the value is the same. */
export function sameTag(a: string, b: string): boolean {
  const strip = (tag: string) => tag.trim().replace(/^W\//, "");
  return strip(a) === strip(b);
}

/** Thrown by a save the server refused because the day changed after the editor loaded it. */
export class SaveConflictError extends Error {
  /** What the server holds now, or null when the day was deleted. */
  readonly current: SavedEntry | null;
  constructor(current: SavedEntry | null) {
    super("This day was changed somewhere else after you opened it.");
    this.name = "SaveConflictError";
    this.current = current;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads one entry from a server response. An older server sends no version: it becomes "". */
export function parseSavedEntry(value: unknown): SavedEntry | null {
  if (!isRecord(value) || typeof value.text !== "string" || !Array.isArray(value.sessionTypes)) return null;
  if (!value.sessionTypes.every((tag: unknown) => typeof tag === "string")) return null;
  const attire = value.attire === "gi" || value.attire === "nogi" ? value.attire : null;
  return {
    text: value.text,
    sessionTypes: value.sessionTypes as string[],
    attire,
    version: typeof value.version === "string" ? value.version : "",
  };
}

/** Reads the body of GET /api/entries, or null when it is not the expected shape. */
export function parseSavedEntries(value: unknown): Record<string, SavedEntry> | null {
  if (!isRecord(value)) return null;
  const entries: Record<string, SavedEntry> = {};
  for (const [date, item] of Object.entries(value)) {
    const entry = parseSavedEntry(item);
    if (!entry) return null;
    entries[date] = entry;
  }
  return entries;
}

/**
 * Adopts a fresh copy of the collection while keeping the existing object for every
 * entry whose version is unchanged. The editor resets its draft when its entry object
 * changes, so an unchanged day must keep its identity. Returns `previous` itself when
 * nothing differs.
 */
export function mergeEntries(
  previous: Record<string, SavedEntry>,
  next: Record<string, SavedEntry>,
): Record<string, SavedEntry> {
  const merged: Record<string, SavedEntry> = {};
  let changed = Object.keys(previous).length !== Object.keys(next).length;
  for (const [date, entry] of Object.entries(next)) {
    const old = Object.hasOwn(previous, date) ? previous[date] : undefined;
    if (old && old.version !== "" && old.version === entry.version) {
      merged[date] = old;
    } else {
      merged[date] = entry;
      changed = true;
    }
  }
  return changed ? merged : previous;
}

export function sameContent(a: JournalEntryData, b: JournalEntryData): boolean {
  return a.text === b.text && a.attire === b.attire && JSON.stringify(a.sessionTypes) === JSON.stringify(b.sessionTypes);
}
