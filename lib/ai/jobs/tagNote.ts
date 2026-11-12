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
  version: 3,
  system:
    "Tag this jiu-jitsu training note with up to 3 tags naming the main techniques or positions it is about. " +
    "Use an existing tag only when the note is clearly about that exact technique; never add one just because it is in the list or a word is mentioned in passing. " +
    "Otherwise create a new short lowercase tag of 1 to 3 words using the technique's usual name. " +
    "For a new tag give its bucket: guard (guards and sweeps), passing (guard passes), leg locks, takedowns (takedowns and standing ties), submissions (chokes and arm locks), escapes (escapes and defenses), pins (mount, side control, knee on belly, north south, back control), other only when none fits. " +
    'Reply with JSON only: {"tags":[{"tag":"..."},{"tag":"...","bucket":"..."}]}, giving a bucket only for a new tag. Reply {"tags":[]} if the note names no technique.',
  // A cap, not a spend: a three-tag reply needs up to about 80 tokens, so 200 leaves room.
  maxOutputTokens: 200,
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
