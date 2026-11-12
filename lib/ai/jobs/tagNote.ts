import { BUCKETS, isBucket, type Bucket } from "../buckets";
import { extractJson } from "./json";

import type { Job } from "../types";

export interface TagNoteArgs {
  text: string;
  tags: readonly string[];
}
export interface TagNoteOut {
  tag: string;
  /** null when the tag already exists. */
  bucket: Bucket | null;
}

export const tagNote: Job<TagNoteArgs, TagNoteOut> = {
  name: "tagNote",
  version: 1,
  system:
    "Pick the one tag that best names the note's main technique or position; reuse an existing tag whenever one fits and create a new short lowercase one only when none does. " +
    'Reply with JSON only: {"tag":"..."} for an existing tag or {"tag":"...","bucket":"..."} for a new one.',
  maxOutputTokens: 30,
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
    const { tag, bucket } = data as { tag?: unknown; bucket?: unknown };
    if (typeof tag !== "string") return null;
    const name = tag.trim().toLowerCase().replace(/\s+/g, " ");
    if (!name || name.length > 40) return null;
    const existing = tags.find((t) => t.toLowerCase() === name);
    if (existing !== undefined) return { tag: existing, bucket: null };
    return { tag: name, bucket: isBucket(bucket) ? bucket : "other" };
  },
};
