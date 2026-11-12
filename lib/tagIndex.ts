import { matchTags } from "./ai/tagMatch";
import { normalizeTerms } from "./glossary";

import type { JournalEntryData } from "../app/types";

export interface IndexedTag {
  name: string;
  bucket: string;
  count: number;
  lastDate: string | null;
  /** Newest first. */
  dates: string[];
}
export interface TagIndex {
  buckets: { bucket: string; tags: IndexedTag[] }[];
  untagged: string[];
}

const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

const newestFirst = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);

export function buildTagIndex(
  entries: Record<string, JournalEntryData>,
  entryTags: Record<string, { tags: readonly { name: string }[] }>,
  tags: Readonly<Record<string, string>>,
  bucketOrder: readonly string[],
): TagIndex {
  const byName = new Map<string, IndexedTag>();
  for (const [name, bucket] of Object.entries(tags)) {
    byName.set(name, { name, bucket, count: 0, lastDate: null, dates: [] });
  }
  const untagged: string[] = [];
  for (const date of Object.keys(entries).sort(newestFirst)) {
    const list = has(entryTags, date) ? entryTags[date].tags : [];
    for (const { name } of list) {
      const indexed = byName.get(name);
      if (!indexed || indexed.dates.includes(date)) continue;
      indexed.dates.push(date);
    }
    if (!list.length && entries[date].text.trim()) untagged.push(date);
  }
  for (const indexed of byName.values()) {
    indexed.count = indexed.dates.length;
    indexed.lastDate = indexed.dates[0] ?? null;
  }

  const grouped = new Map<string, IndexedTag[]>();
  for (const indexed of byName.values()) {
    const bucket = bucketOrder.includes(indexed.bucket) ? indexed.bucket : "other";
    const group = grouped.get(bucket) ?? [];
    group.push(indexed);
    grouped.set(bucket, group);
  }
  const buckets: TagIndex["buckets"] = [];
  const order = bucketOrder.includes("other") ? bucketOrder : [...bucketOrder, "other"];
  for (const bucket of order) {
    const group = grouped.get(bucket);
    if (!group?.length) continue;
    group.sort((a, b) => b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    buckets.push({ bucket, tags: group });
  }
  return { buckets, untagged };
}

export function filterTagIndex(index: TagIndex, query: string): TagIndex["buckets"] {
  const q = query.trim().toLowerCase();
  if (!q) return index.buckets;
  const out: TagIndex["buckets"] = [];
  for (const group of index.buckets) {
    const tags = group.bucket.toLowerCase().includes(q)
      ? group.tags
      : group.tags.filter((t) => t.name.toLowerCase().includes(q));
    if (tags.length) out.push({ bucket: group.bucket, tags });
  }
  return out;
}

export function searchNotes(entries: Record<string, JournalEntryData>, query: string): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return Object.keys(entries)
    .filter((date) => entries[date].text.toLowerCase().includes(q))
    .sort(newestFirst);
}

export function suggestTags(
  text: string,
  tagNames: readonly string[],
  exclude: readonly string[],
  limit = 3,
): string[] {
  return matchTags(text, tagNames, normalizeTerms, tagNames.length)
    .filter((name) => !exclude.includes(name))
    .slice(0, limit);
}
