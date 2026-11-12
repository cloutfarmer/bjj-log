/** Gi or no-gi, or null when the session was logged without recording it. */
export type Attire = "gi" | "nogi";

/** One shared list so the editor toggle and the read-only badge cannot drift. */
export const ATTIRE_OPTIONS: readonly { id: Attire; label: string }[] = [
  { id: "gi", label: "Gi" },
  { id: "nogi", label: "No-Gi" },
];

/** The structured format written by the journal editor. */
export interface JournalEntryData {
  text: string;
  // Keep strings open-ended so older or unfamiliar tags still display unchanged.
  sessionTypes: string[];
  // One choice, not a tag: a session is gi or no-gi, never both. null = unrecorded.
  attire: Attire | null;
}

/** An entry as the server holds it. `version` changes on every save; "" means unknown. */
export type SavedEntry = JournalEntryData & { version: string };

/** Early versions stored just the note text; both formats remain readable. */
export type StoredEntry = string | JournalEntryData;

/** Keys are local calendar dates formatted as YYYY-MM-DD. */
export type StoredEntries = Record<string, StoredEntry>;
