import { ATTIRE_OPTIONS } from "../app/types";
import type { Attire, JournalEntryData } from "../app/types";

/** Unrecorded attire is normal: old notes predate the field, so absence is valid. */
function parseAttire(value: unknown): Attire | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  return ATTIRE_OPTIONS.find((option) => option.id === value)?.id;
}

export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** The one rule for "this day has nothing in it", shared by the editor and the API. */
export function isEmptyEntry(entry: JournalEntryData): boolean {
  // Attire alone still counts as a logged session, so it keeps the day on the calendar.
  return !entry.text.trim() && entry.sessionTypes.length === 0 && entry.attire === null;
}

/** JSON from storage or HTTP is unknown until its contents are checked. */
export function parseEntry(value: unknown): JournalEntryData | null {
  if (typeof value === "string") value = { text: value, sessionTypes: [], attire: null };
  if (!value || typeof value !== "object") return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.text !== "string" || entry.text.length > 50000 || !Array.isArray(entry.sessionTypes) || entry.sessionTypes.length > 20) return null;
  if (!entry.sessionTypes.every((tag: unknown) => typeof tag === "string" && tag.length > 0 && tag.length <= 100)) return null;
  // undefined means a value was supplied that is not one of the known options.
  const attire = parseAttire(entry.attire);
  if (attire === undefined) return null;
  return { text: entry.text, sessionTypes: [...new Set(entry.sessionTypes as string[])], attire };
}
