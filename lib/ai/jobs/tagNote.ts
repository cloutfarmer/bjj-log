import { BUCKETS, isBucket, type Bucket } from "../buckets";
import { extractJson } from "./json";

import type { Job } from "../types";

export interface TagNoteArgs {
  text: string;
  tags: readonly string[];
}
export interface TagNoteOut {
  tags: {
    tag: string;
    /** null when the tag already exists. */
    bucket: Bucket | null;
  }[];
}

const MAX_JOB_TAGS = 3;

export const tagNote: Job<TagNoteArgs, TagNoteOut> = {
  name: "tagNote",
  version: 2,
  system:
    "Pick up to 3 tags that name the note's main techniques or positions; reuse an existing tag whenever one fits and create a new short lowercase one only when none does. " +
    'Reply with JSON only: {"tags":[{"tag":"..."},{"tag":"...","bucket":"..."}]}, giving a bucket only for a new tag. Reply {"tags":[]} if the note names no technique.',
  maxOutputTokens: 80,
  buildInput({ text, tags }) {
    const note = text.replace(/\s+/g, " ").trim().slice(0, 1500);
    return [
      `tags: ${tags.length ? tags.join(", ") : "none"}`,
      `buckets: ${BUCKETS.join(", ")}`,
      `note: ${note}`,
    ].join("\n");
  },
  parseOutput(text, { tags }) {
    const data = extractJson(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const list = (data as { tags?: unknown }).tags;
    if (!Array.isArray(list)) return null;
    const out: TagNoteOut["tags"] = [];
    const seen = new Set<string>();
    for (const item of list) {
      if (out.length >= MAX_JOB_TAGS) break;
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const { tag, bucket } = item as { tag?: unknown; bucket?: unknown };
      if (typeof tag !== "string") continue;
      const name = tag.trim().toLowerCase().replace(/\s+/g, " ");
      if (!name || name.length > 40) continue;
      const existing = tags.find((t) => t.toLowerCase() === name);
      const final = existing ?? name;
      if (seen.has(final)) continue;
      seen.add(final);
      out.push({ tag: final, bucket: existing !== undefined ? null : isBucket(bucket) ? bucket : "other" });
    }
    return { tags: out };
  },
};
