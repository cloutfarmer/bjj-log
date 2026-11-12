import { isDate, parseEntry } from "./entries";
import { isVersion } from "./entrySync";

import type { JournalEntryData } from "../app/types";

/* Unsaved drafts, kept in this browser so a reload, an evicted tab, or an expired session
 * doesn't lose them. One key per day. A draft is removed when it is saved or discarded,
 * and all of them on sign-out. Saved notes are never stored here. */

// Not the legacy "bjj-log-entries" key, which holds old notes offered for import.
const PREFIX = "bjj-log-draft:";

export interface Draft {
  entry: JournalEntryData;
  /**
   * The saved version the draft was started from: null when the day had no entry,
   * undefined when unknown. Saving a restored draft sends it, so a draft based on an
   * older version is refused instead of replacing newer work.
   */
  baseVersion: string | null | undefined;
}

/** Browser storage can hold anything, so a draft is checked before use. */
export function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { entry: rawEntry, baseVersion } = value as { entry?: unknown; baseVersion?: unknown };
  // parseEntry also accepts a bare string, which is the legacy note format, not a draft.
  if (!rawEntry || typeof rawEntry !== "object") return null;
  const entry = parseEntry(rawEntry);
  if (!entry) return null;
  if (baseVersion === null) return { entry, baseVersion: null };
  return { entry, baseVersion: isVersion(baseVersion) ? baseVersion : undefined };
}

export function readDraft(date: string): Draft | null {
  try { return parseDraft(localStorage.getItem(PREFIX + date)); } catch { return null; }
}

// Signing out leaves the page, which hides it, which would write the open draft again.
let signingOut = false;

export function writeDraft(date: string, draft: Draft): void {
  if (signingOut || !isDate(date)) return;
  try { localStorage.setItem(PREFIX + date, JSON.stringify(draft)); } catch { /* The draft stays in the editor. */ }
}

export function clearDraft(date: string): void {
  try { localStorage.removeItem(PREFIX + date); } catch { /* Nothing to remove. */ }
}

/** Called on sign-out. No draft is written again until the next page load. */
export function clearAllDrafts(): void {
  signingOut = true;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch { /* Nothing to remove. */ }
}
