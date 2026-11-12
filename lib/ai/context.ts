import { parseNextItems, stripNextItems } from "../nextItems";

import type { JournalEntryData } from "../../app/types";

export interface NoteForContext {
  date: string;
  entry: JournalEntryData;
  tag: string | null;
}

/** The one compact line format, so every job spends as few input tokens as possible. */
export function compactNote(note: NoteForContext): string {
  const { date, entry, tag } = note;
  const text = stripNextItems(entry.text).replace(/\s+/g, " ").replace(/\|/g, "/").trim();
  const parts = [
    date,
    entry.attire ?? "neither",
    entry.sessionTypes.length ? entry.sessionTypes.join("+") : "-",
    tag ?? "-",
    text,
  ];
  let line = parts.join(" | ");
  for (const item of parseNextItems(entry.text)) {
    const itemText = item.text.replace(/\s+/g, " ").replace(/\|/g, "/");
    line += ` | next: ${itemText} (${item.done ? "done" : "open"})`;
  }
  return line;
}

function byDate(notes: NoteForContext[]): NoteForContext[] {
  return [...notes].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function compactNotes(notes: NoteForContext[]): string {
  return byDate(notes).map(compactNote).join("\n");
}

export interface NoteCounts {
  notes: number;
  tags: Record<string, number>;
  buckets: Record<string, number>;
  nextOpen: number;
  nextDone: number;
}

/** Counting is done here, never by the model, which is slower, dearer and error-prone. */
export function countNotes(notes: NoteForContext[], tagBuckets: Record<string, string>): NoteCounts {
  const counts: NoteCounts = { notes: notes.length, tags: {}, buckets: {}, nextOpen: 0, nextDone: 0 };
  for (const note of notes) {
    if (note.tag) {
      counts.tags[note.tag] = (counts.tags[note.tag] ?? 0) + 1;
      const bucket = Object.prototype.hasOwnProperty.call(tagBuckets, note.tag)
        ? tagBuckets[note.tag]
        : "other";
      counts.buckets[bucket] = (counts.buckets[bucket] ?? 0) + 1;
    }
    for (const item of parseNextItems(note.entry.text)) {
      if (item.done) counts.nextDone += 1;
      else counts.nextOpen += 1;
    }
  }
  return counts;
}

function ranked(record: Record<string, number>): string {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([name, n]) => `${name} ${n}`)
    .join(", ");
}

export function formatCounts(counts: NoteCounts): string {
  return [
    `notes ${counts.notes}`,
    `tags ${ranked(counts.tags) || "none"}`,
    `buckets ${ranked(counts.buckets) || "none"}`,
    `next open ${counts.nextOpen} done ${counts.nextDone}`,
  ].join("; ");
}

export function openNextItems(notes: NoteForContext[]): string[] {
  const out: string[] = [];
  for (const note of byDate(notes)) {
    for (const item of parseNextItems(note.entry.text)) {
      if (!item.done) out.push(`${note.date}: ${item.text}`);
    }
  }
  return out;
}
